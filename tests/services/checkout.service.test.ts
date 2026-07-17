import { Prisma } from '@prisma/client';
import { prisma } from '../../src/config/db.js';
import ApiError from '../../src/utils/ApiError.js';
import {
  getOrCreateCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
} from '../../src/services/cart.service.js';

// Shape returned by prisma.cart.upsert({ include: { items: { include: { productVariant: { include: { product: ... } } } } } })
type CartUpsertResult = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        productVariant: {
          include: {
            product: {
              select: {
                isPublished: true;
                name: true;
                price: true;
              };
            };
          };
        };
      };
    };
  };
}>;

// Shape returned by prisma.cartItem.upsert / update (with productVariant include for stock checks)
type CartItemUpsertResult = Prisma.CartItemGetPayload<{
  include: {
    productVariant: true;
  };
}>;

type VariantWithProduct = Prisma.ProductVariantGetPayload<{
  include: {
    product: {
      select: {
        isPublished: true;
      };
    };
  };
}>;

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    cart: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    cartItem: {
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    productVariant: {
      findFirst: vi.fn(),
    },
  },
}));

const userId = 'user-1';
const otherUserId = 'user-2';
const cartId = 'cart-1';
const cartItemId = 'cart-item-1';
const variantId = 'variant-1';
const productId = 'product-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('cart.service', () => {
  describe('getOrCreateCart', () => {
    it('returns an existing cart with enriched items and a computed total', async () => {
      const cart: CartUpsertResult = {
        id: cartId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 2,
            productVariant: {
              id: variantId,
              productId,
              scent: 'vanilla',
              size: 'large',
              stock: 10,
              createdAt: new Date(),
              updatedAt: new Date(),
              product: {
                isPublished: true,
                name: 'Vanilla Candle',
                price: new Prisma.Decimal('10.00'),
              },
            },
          },
        ],
      };
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(cart);

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(true);
      expect(result.total).toBeDefined();
    });

    it('creates the cart on first-time access via upsert, not find-then-create', async () => {
      const cart: CartUpsertResult = {
        id: cartId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(cart);

      await getOrCreateCart(userId);

      expect(prisma.cart.upsert).toHaveBeenCalled();
    });

    //case not included in documentation - tests for a cart with no item
    it('returns items: [] when an existing cart already has zero items', async () => {
      const cart: CartUpsertResult = {
        id: cartId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(cart);

      const result = await getOrCreateCart(userId);

      expect(result.items).toEqual([]);
      expect(result.total).toBe('0.00');
    });

    it('marks a line whose product is since unpublished as unavailable and excludes it from the total', async () => {
      const cart: CartUpsertResult = {
        id: cartId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 1,
            productVariant: {
              id: variantId,
              productId,
              scent: 'lavender',
              size: 'small',
              stock: 5,
              createdAt: new Date(),
              updatedAt: new Date(),
              product: {
                isPublished: false,
                name: 'Old Candle',
                price: new Prisma.Decimal('8.00'),
              },
            },
          },
        ],
      };
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(cart);

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(false);
      expect(result.total).toBe('0.00');
    });

    it('recomputes the total fresh on every read rather than caching it', async () => {
      const makeCart = (price: string): CartUpsertResult => ({
        id: cartId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 1,
            productVariant: {
              id: variantId,
              productId,
              scent: 'vanilla',
              size: 'large',
              stock: 5,
              createdAt: new Date(),
              updatedAt: new Date(),
              product: {
                isPublished: true,
                name: 'Vanilla Candle',
                price: new Prisma.Decimal(price),
              },
            },
          },
        ],
      });

      vi.mocked(prisma.cart.upsert)
        .mockResolvedValueOnce(makeCart('10.00'))
        .mockResolvedValueOnce(makeCart('20.00'));

      const first = await getOrCreateCart(userId);
      const second = await getOrCreateCart(userId);

      expect(first.total).not.toBe(second.total);
    });
  });

  describe('addItemToCart', () => {
    it('adds a new item within stock', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 2,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('increments an existing item within stock', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 5,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock instead of erroring when requested quantity exceeds stock', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 5,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      const result = await addItemToCart(userId, variantId, 4);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    //case not included in documentation - tests when quantity equals stock
    it('caps at the stock ceiling when the existing quantity already equals stock', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 5,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      const result = await addItemToCart(userId, variantId, 3);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    // case not included in documentation - tests when quantity defaults to 1
    it('defaults quantity to 1 when omitted', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      const result = await addItemToCart(userId, variantId);

      expect(result.cartItem.quantity).toBe(1);
    });

    it('throws 404 when the variant is not found or unpublished', async () => {
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(null);

      await expect(addItemToCart(userId, 'bad-variant', 1)).rejects.toEqual(
        new ApiError(404, 'Product not found'),
      );
    });

    it('throws 409 when stock is exactly zero', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      await expect(addItemToCart(userId, variantId, 1)).rejects.toEqual(
        new ApiError(409, 'This item is out of stock'),
      );
    });

    it('reads stock once and does not re-check or lock against a concurrent race', async () => {
      const variant: VariantWithProduct = {
        id: variantId,
        productId,
        scent: 'vanilla',
        size: 'large',
        stock: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { isPublished: true },
      };
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(variant);

      const cartItem: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(cartItem);

      await addItemToCart(userId, variantId, 1);

      expect(prisma.productVariant.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateCartItemQuantity', () => {
    it('updates to the exact requested quantity within stock', async () => {
      const existing: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(existing);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...existing, quantity: 4 });

      const result = await updateCartItemQuantity(userId, cartItemId, 4);

      expect(result.cartItem.quantity).toBe(4);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock when requested quantity exceeds stock', async () => {
      const existing: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(existing);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...existing, quantity: 3 });

      const result = await updateCartItemQuantity(userId, cartItemId, 7);

      expect(result.cartItem.quantity).toBe(3);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(3);
    });

    // case not included in documentation - tests when quantity equals stock
    it('accepts a requested quantity exactly equal to stock without capping', async () => {
      const existing: CartItemUpsertResult = {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
        productVariant: {
          id: variantId,
          productId,
          scent: 'vanilla',
          size: 'large',
          stock: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(existing);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...existing, quantity: 5 });

      const result = await updateCartItemQuantity(userId, cartItemId, 5);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('throws 404 when the cart item does not exist', async () => {
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(userId, 'bad-item', 2)).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );
    });

    it('throws the same 404 when the item belongs to a different user, with ownership embedded in the query', async () => {
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(otherUserId, cartItemId, 2)).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );

      expect(prisma.cartItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: cartItemId, cart: { userId: otherUserId } }),
        }),
      );
    });
  });

  describe('removeCartItem', () => {
    it('removes an existing owned item', async () => {
      vi.mocked(prisma.cartItem.delete).mockResolvedValueOnce({
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
      });

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBeDefined();
    });

    it('leaves the cart row intact when removing the last item', async () => {
      vi.mocked(prisma.cartItem.delete).mockResolvedValueOnce({
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 1,
      });

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBe('0.00');
      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });

    it('throws 404 when the item does not exist or is not owned', async () => {
      vi.mocked(prisma.cartItem.delete).mockRejectedValueOnce(new Error('Record not found'));

      await expect(removeCartItem(userId, 'bad-item')).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );
    });
  });
});

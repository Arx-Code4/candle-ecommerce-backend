import { prisma } from '../../src/config/db.js';
import ApiError from '../../src/utils/ApiError.js';
import {
  getOrCreateCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
} from '../../src/services/cart.service.js';

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
const cartItemId = 'cart-item-1';
const variantId = 'variant-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('cart.service', () => {
  describe('getOrCreateCart', () => {
    it('returns an existing cart with enriched items and a computed total', async () => {
      (prisma.cart.upsert as any).mockResolvedValueOnce({
        items: [
          {
            id: cartItemId,
            productVariantId: variantId,
            quantity: 2,
            variant: {
              stock: 10,
              product: { isPublished: true, name: 'Vanilla Candle' },
              scent: 'vanilla',
              size: 'large',
              price: '10.00',
            },
          },
        ],
      });

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(true);
      expect(result.total).toBeDefined();
    });

    it('creates the cart on first-time access via upsert, not find-then-create', async () => {
      (prisma.cart.upsert as any).mockResolvedValueOnce({ items: [] });

      await getOrCreateCart(userId);

      expect(prisma.cart.upsert).toHaveBeenCalled();
    });

    //case not included in documentation - tests for a cart with no item
    it('returns items: [] when an existing cart already has zero items', async () => {
      (prisma.cart.upsert as any).mockResolvedValueOnce({ items: [] });

      const result = await getOrCreateCart(userId);

      expect(result.items).toEqual([]);
      expect(result.total).toBe('0.00');
    });

    it('marks a line whose product is since unpublished as unavailable and excludes it from the total', async () => {
      (prisma.cart.upsert as any).mockResolvedValueOnce({
        items: [
          {
            id: cartItemId,
            productVariantId: variantId,
            quantity: 1,
            variant: {
              stock: 5,
              product: { isPublished: false, name: 'Old Candle' },
              scent: 'lavender',
              size: 'small',
              price: '8.00',
            },
          },
        ],
      });

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(false);
      expect(result.total).toBe('0.00');
    });

    it('recomputes the total fresh on every read rather than caching it', async () => {
      (prisma.cart.upsert as any)
        .mockResolvedValueOnce({
          items: [
            {
              id: cartItemId,
              productVariantId: variantId,
              quantity: 1,
              variant: { stock: 5, product: { isPublished: true }, price: '10.00' },
            },
          ],
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: cartItemId,
              productVariantId: variantId,
              quantity: 1,
              variant: { stock: 5, product: { isPublished: true }, price: '20.00' },
            },
          ],
        });

      const first = await getOrCreateCart(userId);
      const second = await getOrCreateCart(userId);

      expect(first.total).not.toBe(second.total);
    });
  });

  describe('addItemToCart', () => {
    it('adds a new item within stock', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 10,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 2,
      });

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('increments an existing item within stock', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 10,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 5,
      });

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock instead of erroring when requested quantity exceeds stock', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 5,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 5,
      });

      const result = await addItemToCart(userId, variantId, 4);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    //case not included in documentation - tests when quantity equals stock
    it('caps at the stock ceiling when the existing quantity already equals stock', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 5,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 5,
      });

      const result = await addItemToCart(userId, variantId, 3);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    // case not included in documentation - tests when quantity defaults to 1
    it('defaults quantity to 1 when omitted', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 10,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 1,
      });

      const result = await addItemToCart(userId, variantId);

      expect(result.cartItem.quantity).toBe(1);
    });

    it('throws 404 when the variant is not found or unpublished', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce(null);

      await expect(addItemToCart(userId, 'bad-variant', 1)).rejects.toEqual(
        new ApiError(404, 'Product not found'),
      );
    });

    it('throws 409 when stock is exactly zero', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 0,
        product: { isPublished: true },
      });

      await expect(addItemToCart(userId, variantId, 1)).rejects.toEqual(
        new ApiError(409, 'This item is out of stock'),
      );
    });

    it('reads stock once and does not re-check or lock against a concurrent race', async () => {
      (prisma.productVariant.findFirst as any).mockResolvedValueOnce({
        id: variantId,
        stock: 5,
        product: { isPublished: true },
      });
      (prisma.cartItem.upsert as any).mockResolvedValueOnce({
        id: cartItemId,
        productVariantId: variantId,
        quantity: 1,
      });

      await addItemToCart(userId, variantId, 1);

      expect(prisma.productVariant.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateCartItemQuantity', () => {
    it('updates to the exact requested quantity within stock', async () => {
      (prisma.cartItem.findFirst as any).mockResolvedValueOnce({
        id: cartItemId,
        variant: { stock: 10 },
      });
      (prisma.cartItem.update as any).mockResolvedValueOnce({ id: cartItemId, quantity: 4 });

      const result = await updateCartItemQuantity(userId, cartItemId, 4);

      expect(result.cartItem.quantity).toBe(4);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock when requested quantity exceeds stock', async () => {
      (prisma.cartItem.findFirst as any).mockResolvedValueOnce({
        id: cartItemId,
        variant: { stock: 3 },
      });
      (prisma.cartItem.update as any).mockResolvedValueOnce({ id: cartItemId, quantity: 3 });

      const result = await updateCartItemQuantity(userId, cartItemId, 7);

      expect(result.cartItem.quantity).toBe(3);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(3);
    });

    // case not included in documentation - tests when quantity equals stock
    it('accepts a requested quantity exactly equal to stock without capping', async () => {
      (prisma.cartItem.findFirst as any).mockResolvedValueOnce({
        id: cartItemId,
        variant: { stock: 5 },
      });
      (prisma.cartItem.update as any).mockResolvedValueOnce({ id: cartItemId, quantity: 5 });

      const result = await updateCartItemQuantity(userId, cartItemId, 5);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('throws 404 when the cart item does not exist', async () => {
      (prisma.cartItem.findFirst as any).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(userId, 'bad-item', 2)).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );
    });

    it('throws the same 404 when the item belongs to a different user, with ownership embedded in the query', async () => {
      (prisma.cartItem.findFirst as any).mockResolvedValueOnce(null);

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
      (prisma.cartItem.delete as any).mockResolvedValueOnce({ id: cartItemId });

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBeDefined();
    });

    it('leaves the cart row intact when removing the last item', async () => {
      (prisma.cartItem.delete as any).mockResolvedValueOnce({ id: cartItemId });

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBe('0.00');
      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });

    it('throws 404 when the item does not exist or is not owned', async () => {
      (prisma.cartItem.delete as any).mockRejectedValueOnce(new Error('Record not found'));

      await expect(removeCartItem(userId, 'bad-item')).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );
    });
  });
});

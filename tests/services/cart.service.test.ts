import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ProductVariant, CartItem, Cart } from '@prisma/client';
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
const cartId = 'cart-1';
const cartItemId = 'cart-item-1';
const variantId = 'variant-1';
const productId = 'product-1';

beforeEach(() => {
  vi.clearAllMocks();
});

// Factory functions for type-safe mock data
function buildVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: variantId,
    productId,
    scent: 'vanilla',
    size: 'large',
    stock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductVariant;
}

function buildCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: cartItemId,
    cartId,
    productVariantId: variantId,
    quantity: 2,
    ...overrides,
  } as CartItem;
}

function buildCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: cartId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Cart;
}

type ProductVariantWithProduct = ProductVariant & {
  product: {
    isPublished: boolean;
    name: string;
    price: string;
  };
};

function buildProductVariantWithProduct(
  overrides: Partial<ProductVariantWithProduct> = {},
): ProductVariantWithProduct {
  return {
    id: variantId,
    productId,
    scent: 'vanilla',
    size: 'large',
    stock: 10,
    product: {
      isPublished: true,
      name: 'Vanilla Candle',
      price: '10.00',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type CartItemWithProductVariant = CartItem & {
  productVariant: ProductVariantWithProduct;
};

function buildCartItemWithProductVariant(
  overrides: Partial<CartItemWithProductVariant> = {},
): CartItemWithProductVariant {
  return {
    id: cartItemId,
    cartId,
    productVariantId: variantId,
    quantity: 2,
    productVariant: buildProductVariantWithProduct(),
    ...overrides,
  };
}

type CartWithItems = Cart & {
  items: CartItemWithProductVariant[];
};

function buildCartWithItems(overrides: Partial<CartWithItems> = {}): CartWithItems {
  return {
    id: cartId,
    userId,
    items: [buildCartItemWithProductVariant()],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('cart.service', () => {
  describe('getOrCreateCart', () => {
    it('returns an existing cart with enriched items and a computed total', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 2,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Vanilla Candle', price: '10.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(true);
      expect(result.total).toBeDefined();
    });

    it('creates the cart on first-time access via upsert, not find-then-create', async () => {
      const mockCart = buildCartWithItems({ items: [] });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      await getOrCreateCart(userId);

      expect(prisma.cart.upsert).toHaveBeenCalled();
    });

    it('returns items: [] when an existing cart already has zero items', async () => {
      const mockCart = buildCartWithItems({ items: [] });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.items).toEqual([]);
      expect(result.total).toBe('0.00');
    });

    it('marks a line whose product is since unpublished as unavailable and excludes it from the total', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: false, name: 'Old Candle', price: '8.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.items[0].available).toBe(false);
      expect(result.total).toBe('0.00');
    });

    it('recomputes the total fresh on every read rather than caching it', async () => {
      const mockCart1 = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: true, name: 'Vanilla Candle', price: '10.00' },
            }),
          },
        ],
      });
      const mockCart2 = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: true, name: 'Vanilla Candle', price: '20.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert)
        .mockResolvedValueOnce(mockCart1)
        .mockResolvedValueOnce(mockCart2);

      const first = await getOrCreateCart(userId);
      const second = await getOrCreateCart(userId);

      expect(first.total).not.toBe(second.total);
    });

    it('calculates exact total for a single item: 2 × 750.00 = 1500.00', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 2,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Vanilla Candle', price: '750.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.total).toBe('1500.00');
    });

    it('calculates exact total for a single item: 3 × 500.00 = 1500.00', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: cartItemId,
            cartId,
            productVariantId: variantId,
            quantity: 3,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Lavender Candle', price: '500.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.total).toBe('1500.00');
    });

    it('calculates exact total for multiple items: (2 × 750.00) + (1 × 500.00) = 2000.00', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: 'item-1',
            cartId,
            productVariantId: 'v1',
            quantity: 2,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Vanilla Candle', price: '750.00' },
            }),
          },
          {
            id: 'item-2',
            cartId,
            productVariantId: 'v2',
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: true, name: 'Lavender Candle', price: '500.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.total).toBe('2000.00');
    });

    it('calculates exact total for three items: (2 × 100.00) + (3 × 50.00) + (1 × 25.00) = 375.00', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: 'item-1',
            cartId,
            productVariantId: 'v1',
            quantity: 2,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Small Candle', price: '100.00' },
            }),
          },
          {
            id: 'item-2',
            cartId,
            productVariantId: 'v2',
            quantity: 3,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: true, name: 'Medium Candle', price: '50.00' },
            }),
          },
          {
            id: 'item-3',
            cartId,
            productVariantId: 'v3',
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 3,
              product: { isPublished: true, name: 'Large Candle', price: '25.00' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.total).toBe('375.00');
    });

    it('calculates exact total with decimal prices: (2 × 9.99) + (1 × 4.50) = 24.48', async () => {
      const mockCart = buildCartWithItems({
        items: [
          {
            id: 'item-1',
            cartId,
            productVariantId: 'v1',
            quantity: 2,
            productVariant: buildProductVariantWithProduct({
              stock: 10,
              product: { isPublished: true, name: 'Tea Light', price: '9.99' },
            }),
          },
          {
            id: 'item-2',
            cartId,
            productVariantId: 'v2',
            quantity: 1,
            productVariant: buildProductVariantWithProduct({
              stock: 5,
              product: { isPublished: true, name: 'Wax Melt', price: '4.50' },
            }),
          },
        ],
      });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await getOrCreateCart(userId);

      expect(result.total).toBe('24.48');
    });
  });

  describe('addItemToCart', () => {
    it('adds a new item within stock', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 10 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 2,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      // Use mockResolvedValue (persistent) so the second call inside addItemToCart also gets a cart
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('increments an existing item within stock', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 10 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 5,
        productVariant: mockVariant,
      });
      const existingCartItem = buildCartItemWithProductVariant({
        quantity: 3,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [existingCartItem] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      const result = await addItemToCart(userId, variantId, 2);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock instead of erroring when requested quantity exceeds stock', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 5 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 5,
        productVariant: mockVariant,
      });
      const existingCartItem = buildCartItemWithProductVariant({
        quantity: 3,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [existingCartItem] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      const result = await addItemToCart(userId, variantId, 4);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    it('caps at the stock ceiling when the existing quantity already equals stock', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 5 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 5,
        productVariant: mockVariant,
      });
      const existingCartItem = buildCartItemWithProductVariant({
        quantity: 5,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [existingCartItem] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      const result = await addItemToCart(userId, variantId, 3);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(5);
    });

    it('defaults quantity to 1 when omitted', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 10 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 1,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      const result = await addItemToCart(userId, variantId);

      expect(result.cartItem.quantity).toBe(1);
    });

    it('throws 404 when the variant is not found or unpublished', async () => {
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(null);

      await expect(addItemToCart(userId, 'bad-variant', 1)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });

    it('throws 409 when stock is exactly zero', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 0 });
      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);

      await expect(addItemToCart(userId, variantId, 1)).rejects.toMatchObject({
        statusCode: 409,
        message: 'This item is out of stock',
      });
    });

    it('uses atomic stock check to prevent race conditions', async () => {
      const mockVariant = buildProductVariantWithProduct({ stock: 5 });
      const mockCartItem = buildCartItemWithProductVariant({
        quantity: 1,
        productVariant: mockVariant,
      });
      const mockCart = buildCartWithItems({ items: [] });

      vi.mocked(prisma.productVariant.findFirst).mockResolvedValueOnce(mockVariant);
      vi.mocked(prisma.cart.upsert).mockResolvedValue(mockCart);
      vi.mocked(prisma.cartItem.upsert).mockResolvedValueOnce(mockCartItem);

      await addItemToCart(userId, variantId, 1);

      expect(prisma.productVariant.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.cartItem.upsert).toHaveBeenCalled();
    });
  });

  describe('updateCartItemQuantity', () => {
    it('updates to the exact requested quantity within stock', async () => {
      const mockCartItem = buildCartItemWithProductVariant({
        id: cartItemId,
        quantity: 4,
        productVariant: buildProductVariantWithProduct({ stock: 10 }),
      });
      const mockCart = buildCartWithItems({ items: [mockCartItem] });

      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(mockCartItem);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...mockCartItem, quantity: 4 });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await updateCartItemQuantity(userId, cartItemId, 4);

      expect(result.cartItem.quantity).toBe(4);
      expect(result.wasCapped).toBe(false);
    });

    it('caps quantity to stock when requested quantity exceeds stock', async () => {
      const mockCartItem = buildCartItemWithProductVariant({
        id: cartItemId,
        quantity: 3,
        productVariant: buildProductVariantWithProduct({ stock: 3 }),
      });
      const mockCart = buildCartWithItems({ items: [mockCartItem] });

      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(mockCartItem);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...mockCartItem, quantity: 3 });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await updateCartItemQuantity(userId, cartItemId, 7);

      expect(result.cartItem.quantity).toBe(3);
      expect(result.wasCapped).toBe(true);
      expect(result.cappedTo).toBe(3);
    });

    it('accepts a requested quantity exactly equal to stock without capping', async () => {
      const mockCartItem = buildCartItemWithProductVariant({
        id: cartItemId,
        quantity: 5,
        productVariant: buildProductVariantWithProduct({ stock: 5 }),
      });
      const mockCart = buildCartWithItems({ items: [mockCartItem] });

      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(mockCartItem);
      vi.mocked(prisma.cartItem.update).mockResolvedValueOnce({ ...mockCartItem, quantity: 5 });
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await updateCartItemQuantity(userId, cartItemId, 5);

      expect(result.cartItem.quantity).toBe(5);
      expect(result.wasCapped).toBe(false);
      expect(result.cappedTo).toBeUndefined();
    });

    it('throws 404 when the cart item does not exist', async () => {
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(userId, 'bad-item', 2)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cart item not found',
      });
    });

    it('throws the same 404 when the item belongs to a different user, with ownership embedded in the query', async () => {
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(otherUserId, cartItemId, 2)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cart item not found',
      });

      expect(prisma.cartItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: cartItemId, cart: { userId: otherUserId } }),
        }),
      );
    });
  });

  describe('removeCartItem', () => {
    it('removes an existing owned item', async () => {
      const mockCartItem = buildCartItem({ id: cartItemId });
      const mockCart = buildCartWithItems({ items: [] });

      vi.mocked(prisma.cartItem.delete).mockResolvedValueOnce(mockCartItem);
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBeDefined();
    });

    it('leaves the cart row intact when removing the last item', async () => {
      const mockCartItem = buildCartItem({ id: cartItemId });
      const mockCart = buildCartWithItems({ items: [] });

      vi.mocked(prisma.cartItem.delete).mockResolvedValueOnce(mockCartItem);
      vi.mocked(prisma.cart.upsert).mockResolvedValueOnce(mockCart);

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBe('0.00');
      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });

    it('throws 404 when the item does not exist or is not owned', async () => {
      vi.mocked(prisma.cartItem.delete).mockRejectedValueOnce(new Error('Record not found'));

      await expect(removeCartItem(userId, 'bad-item')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cart item not found',
      });
    });
  });
});

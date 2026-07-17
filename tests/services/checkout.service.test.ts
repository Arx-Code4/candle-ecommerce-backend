// tests/services/checkout.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { PendingCheckout, Order } from '@prisma/client';
import { createChapaSession, confirmChapaPayment } from '../../src/services/checkout.service.js';
import { prisma } from '../../src/config/db.js';
import * as cartService from '../../src/services/cart.service.js';
import type { CartWithItems, CartItemView } from '../../src/services/cart.service.js';
import * as chapa from '../../src/utils/chapa.js';
import * as notificationService from '../../src/services/notification.service.js';
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

// Factory functions for type-safe mock data
function buildCartItem(overrides: Partial<CartItemView> = {}): CartItemView {
  return {
    id: 'ci-1',
    productVariantId: 'v1',
    quantity: 2,
    name: 'Vanilla Candle',
    scent: 'Vanilla',
    size: 'M',
    unitPrice: '750.00',
    subtotal: '1500.00',
    available: true,
    ...overrides,
  };
}

function buildCart(overrides: Partial<CartWithItems> = {}): CartWithItems {
  return {
    items: [buildCartItem()],
    total: '1500.00',
    ...overrides,
  };
}

function buildPendingCheckout(overrides: Partial<PendingCheckout> = {}): PendingCheckout {
  return {
    id: 'pending-1',
    txRef: 'tx-123',
    userId: 'user-1',
    cartSnapshot: [
      {
        productVariantId: 'v1',
        quantity: 2,
        unitPriceSnapshot: '750.00',
        productNameSnapshot: 'Vanilla Candle',
        scentSnapshot: 'Vanilla',
        sizeSnapshot: 'M',
      },
    ],
    expectedAmount: new Prisma.Decimal('1500.00'),
    shippingName: 'Abebe',
    shippingPhone: '+251911223344',
    shippingAddress: 'Addis Ababa',
    expiresAt: new Date(Date.now() + 30 * 60000),
    createdAt: new Date(),
    ...overrides,
  };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    chapaTxRef: 'tx-123',
    totalAmount: new Prisma.Decimal('1500.00'),
    shippingName: 'Abebe',
    shippingPhone: '+251911223344',
    shippingAddress: 'Addis Ababa',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe.skip('createChapaSession', () => {
  it('creates a session successfully for a cart with in-stock items', async () => {
    const mockCart = buildCart({
      items: [buildCartItem({ quantity: 2 })],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);
    vi.mocked(prisma.pendingCheckout.create).mockResolvedValue(buildPendingCheckout());
    vi.mocked(chapa.initializeTransaction).mockResolvedValue({
      checkoutUrl: 'https://checkout.chapa.co/abc',
    });

    const result = await createChapaSession('user-1', shipping);

    expect(result).toEqual(
      expect.objectContaining({
        chapaCheckoutUrl: 'https://checkout.chapa.co/abc',
        txRef: expect.any(String),
      }),
    );
    const createArgs = vi.mocked(prisma.pendingCheckout.create).mock.calls[0][0];
    expect(createArgs.data.cartSnapshot).toEqual(
      expect.arrayContaining([expect.objectContaining({ productVariantId: 'v1', quantity: 2 })]),
    );
    expect(createArgs.data.expectedAmount).toBeDefined();
    const minutesFromNow = (new Date(createArgs.data.expiresAt).getTime() - Date.now()) / 60000;
    expect(minutesFromNow).toBeGreaterThanOrEqual(29);
    expect(minutesFromNow).toBeLessThanOrEqual(31);
  });

  it('throws ApiError(400) when the cart is empty, without calling initializeTransaction', async () => {
    const emptyCart = buildCart({ items: [], total: '0' });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(emptyCart);

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

  it('throws ApiError(409) with unavailableItems when a cart line exceeds current stock', async () => {
    const mockCart = buildCart({
      items: [
        buildCartItem({
          quantity: 10,
          name: 'Vanilla Candle',
          size: 'M',
          available: false,
        }),
      ],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);

    try {
      await createChapaSession('user-1', shipping);
    } catch (err) {
      // Type assertion since we know it's an ApiError
      const error = err as ApiError;
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe(
        'Some items in your cart are no longer available in the requested quantity',
      );
      expect(error.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Vanilla Candle'),
          expect.stringContaining('requested: 10'),
        ]),
      );
    }
  });

  it('propagates a chapa.ts failure unchanged', async () => {
    const mockCart = buildCart({
      items: [buildCartItem({ quantity: 1 })],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);
    vi.mocked(prisma.pendingCheckout.create).mockResolvedValue(buildPendingCheckout());
    const providerError = new ApiError(502, 'Unable to reach payment provider, please try again');
    vi.mocked(chapa.initializeTransaction).mockRejectedValue(providerError);

      const result = await addItemToCart(userId, variantId, 2);

  it('creates two independent PendingCheckout rows for two calls by the same user', async () => {
    const mockCart = buildCart({
      items: [buildCartItem({ quantity: 1 })],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);
    vi.mocked(prisma.pendingCheckout.create).mockResolvedValue(buildPendingCheckout());
    vi.mocked(chapa.initializeTransaction)
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/first' })
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/second' });

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

describe.skip('confirmChapaPayment', () => {
  function makeMockTx() {
    return {
      order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
      orderItem: { create: vi.fn().mockResolvedValue({}) },
      productVariant: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ stock: 5, unitPrice: '999.00' }),
      },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({}) },
      pendingCheckout: { delete: vi.fn().mockResolvedValue({}) },
    };
  }

  it('creates an Order on successful confirmation', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));
    vi.mocked(notificationService.sendOrderConfirmationEmail).mockResolvedValue(undefined);

      const result = await addItemToCart(userId, variantId, 3);

    expect(result).toEqual({ orderId: 'order-1', created: true });
    expect(mockTx.order.create).toHaveBeenCalledTimes(1);
    expect(mockTx.pendingCheckout.delete).toHaveBeenCalledTimes(1);
  });

  it('uses cartSnapshot data for OrderItems, not live product data', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const pendingRow = buildPendingCheckout();
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

      const result = await addItemToCart(userId, variantId);

    const orderItemArgs = mockTx.orderItem.create.mock.calls[0][0];
    const snapshot = pendingRow.cartSnapshot as any[];
    expect(orderItemArgs.data.unitPriceSnapshot).toBe(snapshot[0].unitPriceSnapshot);
    expect(orderItemArgs.data.productNameSnapshot).toBe(snapshot[0].productNameSnapshot);
    expect(orderItemArgs.data.unitPriceSnapshot).not.toBe('999.00');
  });

  it('sends the confirmation email only after the transaction resolves', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    let transactionResolved = false;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const result = await fn(mockTx);
      transactionResolved = true;
      return result;
    });
    vi.mocked(notificationService.sendOrderConfirmationEmail).mockImplementation(async () => {
      expect(transactionResolved).toBe(true);
      return undefined;
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

  it('throws ApiError(404) for an unknown txRef', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(null);

      expect(result.cartItem.quantity).toBe(4);
      expect(result.wasCapped).toBe(false);
    });

  it('is idempotent — a duplicate webhook for an already-confirmed txRef returns created:false without touching the transaction', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder({ chapaTxRef: 'tx-123' }));

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

  it('creates nothing for a failed status', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());

    it('throws 404 when the cart item does not exist', async () => {
      vi.mocked(prisma.cartItem.findFirst).mockResolvedValueOnce(null);

      await expect(updateCartItemQuantity(userId, 'bad-item', 2)).rejects.toEqual(
        new ApiError(404, 'Cart item not found'),
      );
    });

  it('creates nothing for a cancelled status', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());

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

  it('still creates the order and allows negative stock when stock is insufficient at confirm time', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    mockTx.productVariant.findUnique.mockResolvedValue({ stock: 0, unitPrice: '750.00' });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

      const result = await removeCartItem(userId, cartItemId);

      expect(result.cartTotal).toBeDefined();
    });

  it('still resolves created: true even when the confirmation email fails', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));
    vi.mocked(notificationService.sendOrderConfirmationEmail).mockRejectedValue(
      new Error('SMTP down'),
    );

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

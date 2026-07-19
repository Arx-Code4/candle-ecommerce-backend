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

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    pendingCheckout: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/services/cart.service.js', () => ({
  getOrCreateCart: vi.fn(),
}));

vi.mock('../../src/utils/chapa.js', () => ({
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

const shipping = {
  shippingName: 'Abebe',
  shippingPhone: '+251911223344',
  shippingAddress: 'Addis Ababa',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chapa.verifyTransaction).mockResolvedValue({
    status: 'success',
    amount: '1500.00',
  });
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

describe('createChapaSession', () => {
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

    await expect(createChapaSession('user-1', shipping)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Your cart is empty',
    });
    expect(chapa.initializeTransaction).not.toHaveBeenCalled();
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

    await expect(createChapaSession('user-1', shipping)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Some items in your cart are no longer available in the requested quantity',
      errors: expect.arrayContaining([
        expect.stringContaining('Vanilla Candle'),
        expect.stringContaining('requested: 10'),
      ]),
    });
  });

  it('propagates a chapa.ts failure unchanged', async () => {
    const mockCart = buildCart({
      items: [buildCartItem({ quantity: 1 })],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);
    vi.mocked(prisma.pendingCheckout.create).mockResolvedValue(buildPendingCheckout());
    const providerError = new ApiError(502, 'Unable to reach payment provider, please try again');
    vi.mocked(chapa.initializeTransaction).mockRejectedValue(providerError);

    await expect(createChapaSession('user-1', shipping)).rejects.toBe(providerError);
  });

  it('creates two independent PendingCheckout rows for two calls by the same user', async () => {
    const mockCart = buildCart({
      items: [buildCartItem({ quantity: 1 })],
    });
    vi.mocked(cartService.getOrCreateCart).mockResolvedValue(mockCart);
    vi.mocked(prisma.pendingCheckout.create).mockResolvedValue(buildPendingCheckout());
    vi.mocked(chapa.initializeTransaction)
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/first' })
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/second' });

    const first = await createChapaSession('user-1', shipping);
    const second = await createChapaSession('user-1', shipping);

    expect(first.txRef).not.toBe(second.txRef);
    expect(prisma.pendingCheckout.create).toHaveBeenCalledTimes(2);
  });
});

describe('confirmChapaPayment', () => {
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

    const result = await confirmChapaPayment('tx-123', 'success');

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

    await confirmChapaPayment('tx-123', 'success');

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

    await confirmChapaPayment('tx-123', 'success');

    expect(notificationService.sendOrderConfirmationEmail).toHaveBeenCalled();
  });

  it('throws ApiError(404) for an unknown txRef', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(null);

    await expect(confirmChapaPayment('bad-tx', 'success')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Unknown transaction reference',
    });
  });

  it('is idempotent — a duplicate webhook for an already-confirmed txRef returns created:false without touching the transaction', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder({ chapaTxRef: 'tx-123' }));

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: false });
    expect(prisma.pendingCheckout.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('creates nothing for a failed status', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());

    const result = await confirmChapaPayment('tx-123', 'failed');

    expect(result).toEqual({ created: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates nothing for a cancelled status', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());

    const result = await confirmChapaPayment('tx-123', 'cancelled');

    expect(result).toEqual({ created: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still creates the order and allows negative stock when stock is insufficient at confirm time', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    mockTx.productVariant.findUnique.mockResolvedValue({ stock: 0, unitPrice: '750.00' });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: true });
    expect(mockTx.order.create).toHaveBeenCalledTimes(1);
  });

  it('still resolves created: true even when the confirmation email fails', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(buildPendingCheckout());
    const mockTx = makeMockTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));
    vi.mocked(notificationService.sendOrderConfirmationEmail).mockRejectedValue(
      new Error('SMTP down'),
    );

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: true });
  });

  it('throws ApiError(409) when the verified payment amount does not match the expected amount', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    const pendingRow = buildPendingCheckout({
      expectedAmount: new Prisma.Decimal('1500.00'),
    });
    vi.mocked(prisma.pendingCheckout.findUnique).mockResolvedValue(pendingRow);
    vi.mocked(chapa.verifyTransaction).mockResolvedValue({
      status: 'success',
      amount: '1200.00', // Mismatch: expected 1500.00
    });
    // This should never be called - amount mismatch is checked first
    vi.mocked(prisma.$transaction).mockImplementation(async () => {
      throw new Error('Transaction should not be called');
    });

    await expect(confirmChapaPayment('tx-123', 'success')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Payment amount mismatch - please contact support',
      errors: expect.arrayContaining([
        expect.stringContaining('Expected: 1500.00'),
        expect.stringContaining('Paid: 1200.00'),
      ]),
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

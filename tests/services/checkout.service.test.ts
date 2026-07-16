// tests/services/checkout.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChapaSession, confirmChapaPayment } from '../../src/services/checkout.service.js';
import { prisma } from '../../src/config/db.js';
import * as cartService from '../../src/services/cart.service.js';
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
});

describe.skip('createChapaSession', () => {
  it('creates a session successfully for a cart with in-stock items', async () => {
    (cartService.getOrCreateCart as any).mockResolvedValue({
      items: [
        {
          variantId: 'v1',
          quantity: 2,
          variant: {
            stock: 5,
            unitPrice: '750.00',
            name: 'Vanilla Candle',
            scent: 'Vanilla',
            size: 'M',
          },
        },
      ],
    });
    (prisma.pendingCheckout.create as any).mockResolvedValue({});
    (chapa.initializeTransaction as any).mockResolvedValue({
      checkoutUrl: 'https://checkout.chapa.co/abc',
    });

    const result = await createChapaSession('user-1', shipping);

    expect(result).toEqual(
      expect.objectContaining({
        chapaCheckoutUrl: 'https://checkout.chapa.co/abc',
        txRef: expect.any(String),
      }),
    );
    const createArgs = (prisma.pendingCheckout.create as any).mock.calls[0][0];
    expect(createArgs.data.cartSnapshot).toEqual(
      expect.arrayContaining([expect.objectContaining({ variantId: 'v1', quantity: 2 })]),
    );
    expect(createArgs.data.expectedAmount).toBeDefined();
    const minutesFromNow = (new Date(createArgs.data.expiresAt).getTime() - Date.now()) / 60000;
    expect(minutesFromNow).toBeGreaterThanOrEqual(29);
    expect(minutesFromNow).toBeLessThanOrEqual(31);
  });

  it('throws ApiError(400) when the cart is empty, without calling initializeTransaction', async () => {
    (cartService.getOrCreateCart as any).mockResolvedValue({ items: [] });

    await expect(createChapaSession('user-1', shipping)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Your cart is empty',
    });
    expect(chapa.initializeTransaction).not.toHaveBeenCalled();
  });

  it('throws ApiError(409) with unavailableItems when a cart line exceeds current stock', async () => {
    (cartService.getOrCreateCart as any).mockResolvedValue({
      items: [
        {
          variantId: 'v1',
          quantity: 10,
          variant: {
            stock: 2,
            unitPrice: '750.00',
            name: 'Vanilla Candle',
            scent: 'Vanilla',
            size: 'M',
          },
        },
      ],
    });

    await expect(createChapaSession('user-1', shipping)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Some items in your cart are no longer available in the requested quantity',
    });
  });

  it('propagates a chapa.ts failure unchanged', async () => {
    (cartService.getOrCreateCart as any).mockResolvedValue({
      items: [
        {
          variantId: 'v1',
          quantity: 1,
          variant: {
            stock: 5,
            unitPrice: '750.00',
            name: 'Vanilla Candle',
            scent: 'Vanilla',
            size: 'M',
          },
        },
      ],
    });
    (prisma.pendingCheckout.create as any).mockResolvedValue({});
    const providerError = new ApiError(502, 'Unable to reach payment provider, please try again');
    (chapa.initializeTransaction as any).mockRejectedValue(providerError);

    await expect(createChapaSession('user-1', shipping)).rejects.toBe(providerError);
  });

  it('creates two independent PendingCheckout rows for two calls by the same user', async () => {
    (cartService.getOrCreateCart as any).mockResolvedValue({
      items: [
        {
          variantId: 'v1',
          quantity: 1,
          variant: {
            stock: 5,
            unitPrice: '750.00',
            name: 'Vanilla Candle',
            scent: 'Vanilla',
            size: 'M',
          },
        },
      ],
    });
    (prisma.pendingCheckout.create as any).mockResolvedValue({});
    (chapa.initializeTransaction as any)
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/first' })
      .mockResolvedValueOnce({ checkoutUrl: 'https://checkout.chapa.co/second' });

    const first = await createChapaSession('user-1', shipping);
    const second = await createChapaSession('user-1', shipping);

    expect(first.txRef).not.toBe(second.txRef);
    expect(prisma.pendingCheckout.create).toHaveBeenCalledTimes(2);
  });
});

describe.skip('confirmChapaPayment', () => {
  const pendingRow = {
    txRef: 'tx-123',
    userId: 'user-1',
    cartSnapshot: [
      {
        variantId: 'v1',
        quantity: 2,
        unitPriceSnapshot: '750.00',
        nameSnapshot: 'Vanilla Candle',
        scentSnapshot: 'Vanilla',
        sizeSnapshot: 'M',
      },
    ],
    expectedAmount: '1500.00',
  };

  // Shared fake `tx` object used by tests that need to inspect what the real
  // implementation passes into prisma.$transaction(async (tx) => {...}).
  // FLAG: method names (tx.order.create, tx.orderItem.create, etc.) are a
  // best guess from eco-4's schema — adjust to match the real implementation's
  // actual Prisma calls once confirmChapaPayment is written.
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
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockTx));
    (notificationService.sendOrderConfirmationEmail as any).mockResolvedValue(undefined);

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.order.create).toHaveBeenCalledTimes(1);
  });

  it('uses cartSnapshot data for OrderItems, not live product data', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    // live product price (999.00) deliberately differs from the snapshot (750.00)
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockTx));

    await confirmChapaPayment('tx-123', 'success');

    const orderItemArgs = mockTx.orderItem.create.mock.calls[0][0];
    expect(orderItemArgs.data.unitPriceSnapshot).toBe(pendingRow.cartSnapshot[0].unitPriceSnapshot);
    expect(orderItemArgs.data.nameSnapshot).toBe(pendingRow.cartSnapshot[0].nameSnapshot);
    expect(orderItemArgs.data.unitPriceSnapshot).not.toBe('999.00');
  });

  it('sends the confirmation email only after the transaction resolves', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    let transactionResolved = false;
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const result = await fn(mockTx);
      transactionResolved = true;
      return result;
    });
    (notificationService.sendOrderConfirmationEmail as any).mockImplementation(async () => {
      expect(transactionResolved).toBe(true);
    });

    await confirmChapaPayment('tx-123', 'success');

    expect(notificationService.sendOrderConfirmationEmail).toHaveBeenCalled();
  });

  it('throws ApiError(404) for an unknown txRef', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(null);

    await expect(confirmChapaPayment('bad-tx', 'success')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Unknown transaction reference',
    });
  });

  // --- Idempotency: TWO alternative tests below, covering the two mechanisms
  // the real implementation might use. Delete whichever doesn't match once
  // checkout.service.ts is actually written — keep only the one that applies.

  it('[VARIANT A — pre-check] is idempotent when a prior Order already exists for this txRef', async () => {
    // Assumes the service checks prisma.order.findUnique({ where: { chapaTxRef } })
    // BEFORE opening a transaction, short-circuiting on a match.
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    (prisma.order.findUnique as any).mockResolvedValue({ id: 'order-1', chapaTxRef: 'tx-123' });

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('[VARIANT B — catch P2002] is idempotent when the transaction itself hits a unique-constraint violation on chapaTxRef', async () => {
    // Assumes the service attempts the write inside $transaction and catches
    // a Prisma P2002 error on Order.chapaTxRef, rather than pre-checking.
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    (prisma.order.findUnique as any).mockResolvedValue(null); // no pre-check match
    const p2002: any = new Error('Unique constraint failed on the fields: (`chapaTxRef`)');
    p2002.code = 'P2002';
    (prisma.$transaction as any).mockRejectedValueOnce(p2002);
    // Second lookup after catching P2002, to resolve the existing order id for the response
    (prisma.order.findUnique as any).mockResolvedValueOnce({ id: 'order-1', chapaTxRef: 'tx-123' });

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: false });
    expect(notificationService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('creates nothing for a failed status', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);

    const result = await confirmChapaPayment('tx-123', 'failed');

    expect(result).toEqual({ created: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates nothing for a cancelled status', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);

    const result = await confirmChapaPayment('tx-123', 'cancelled');

    expect(result).toEqual({ created: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still creates the order and allows negative stock when stock is insufficient at confirm time', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    mockTx.productVariant.findUnique.mockResolvedValue({ stock: 0, unitPrice: '750.00' });
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockTx));

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: true });
    expect(mockTx.order.create).toHaveBeenCalledTimes(1);
  });

  it('still resolves created: true even when the confirmation email fails', async () => {
    (prisma.pendingCheckout.findUnique as any).mockResolvedValue(pendingRow);
    const mockTx = makeMockTx();
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockTx));
    (notificationService.sendOrderConfirmationEmail as any).mockRejectedValue(
      new Error('SMTP down'),
    );

    const result = await confirmChapaPayment('tx-123', 'success');

    expect(result).toEqual({ orderId: 'order-1', created: true });
  });
});

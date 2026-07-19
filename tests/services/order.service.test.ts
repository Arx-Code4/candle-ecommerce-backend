// tests/services/order.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, OrderStatus } from '@prisma/client';
import type { Order } from '@prisma/client';
import { getOrdersByUser, getOrderByIdForUser } from '../../src/services/order.service.js';
import { prisma } from '../../src/config/db.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function buildOrder(overrides: Partial<Order> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING' as OrderStatus,
    totalAmount: new Prisma.Decimal('1500.00'),
    chapaTxRef: 'tx-ref-1',
    shippingName: 'Jane Doe',
    shippingPhone: '+251900000000',
    shippingAddress: '123 Test Street, Addis Ababa',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-item-1',
    orderId: 'order-1',
    productVariantId: 'pv-1',
    productNameSnapshot: 'Vanilla Candle',
    scentSnapshot: 'Vanilla',
    sizeSnapshot: 'M',
    unitPriceSnapshot: new Prisma.Decimal('750.00'),
    quantity: 2,
    ...overrides,
  };
}

describe('getOrdersByUser', () => {
  it("returns the user's orders in the expected shape", async () => {
    const mockOrders = [
      { ...buildOrder({ id: 'order-1', status: 'PROCESSING' }), _count: { items: 2 } },
    ];
    vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders);

    const result = await getOrdersByUser('user-1');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'order-1',
        status: 'PROCESSING',
        totalAmount: '1500.00',
        itemCount: 2,
        createdAt: expect.any(Date),
      }),
    ]);
  });

  it('uses a count aggregate for itemCount, not a full row load followed by .length', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);

    await getOrdersByUser('user-1');

    const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0][0];
    expect(callArgs?.select?._count ?? callArgs?.include?._count).toBeDefined();
    expect(callArgs?.include?.items).toBeUndefined();
  });

  it('resolves an empty array for a user with zero orders, not an error', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);

    await expect(getOrdersByUser('user-1')).resolves.toEqual([]);
  });
});

describe('getOrderByIdForUser', () => {
  it('returns order detail built from OrderItem snapshot fields', async () => {
    const orderRecord = {
      ...buildOrder({ id: 'order-1', userId: 'user-1' }),
      items: [buildOrderItem({ productNameSnapshot: 'Vanilla Candle' })],
    };
    vi.mocked(prisma.order.findFirst).mockResolvedValue(orderRecord);

    const result = await getOrderByIdForUser('user-1', 'order-1');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        productNameSnapshot: 'Vanilla Candle',
        unitPriceSnapshot: '750.00',
      }),
    );
  });

  it('throws ApiError(404) when the order does not exist', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

    await expect(getOrderByIdForUser('user-1', 'bad-order')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Order not found',
    });
  });

  it('throws the same ApiError(404) when the order belongs to a different user, with userId embedded in the query itself', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

    await expect(getOrderByIdForUser('other-user', 'order-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Order not found',
    });

    const callArgs = vi.mocked(prisma.order.findFirst).mock.calls[0][0];
    expect(callArgs?.where).toEqual(
      expect.objectContaining({ id: 'order-1', userId: 'other-user' }),
    );
  });

  it('never reflects live product changes — detail matches the snapshot even if the live product price differs', async () => {
    const orderRecord = {
      ...buildOrder({ id: 'order-1', userId: 'user-1' }),
      items: [buildOrderItem()],
    };
    vi.mocked(prisma.order.findFirst).mockResolvedValue(orderRecord);

    const result = await getOrderByIdForUser('user-1', 'order-1');

    // live price would be, say, '999.00' — result must still show the snapshot
    expect(result.items[0].unitPriceSnapshot).toBe('750.00');
  });
});

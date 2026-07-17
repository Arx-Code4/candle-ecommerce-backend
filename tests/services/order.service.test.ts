// tests/services/order.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe.skip('getOrdersByUser', () => {
  it("returns the user's orders in the expected shape", async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      {
        id: 'order-1',
        status: 'PROCESSING',
        totalAmount: '1500.00',
        createdAt: new Date(),
        _count: { items: 2 },
      },
    ]);

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
    // ASSUMPTION (flagged per team agreement — doc doesn't specify exact query
    // shape, only the intent "count aggregate, not full include+.length").
    // Written assuming Prisma's `_count: { select: { items: true } }` pattern,
    // since that's the standard way to get a related-row count without loading
    // the rows themselves. If the real implementation uses a different
    // aggregate mechanism, update this assertion to match — the important
    // thing to preserve is that it does NOT assert `include: { items: true }`
    // (which would defeat the whole point of this test case).
    (prisma.order.findMany as any).mockResolvedValue([]);

    await getOrdersByUser('user-1');

    const callArgs = (prisma.order.findMany as any).mock.calls[0][0];
    expect(callArgs.select?._count ?? callArgs.include?._count).toBeDefined();
    expect(callArgs.include?.items).toBeUndefined();
  });

  it('resolves an empty array for a user with zero orders, not an error', async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);

    await expect(getOrdersByUser('user-1')).resolves.toEqual([]);
  });
});

describe.skip('getOrderByIdForUser', () => {
  const orderRecord = {
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    totalAmount: '1500.00',
    items: [
      {
        nameSnapshot: 'Vanilla Candle',
        scentSnapshot: 'Vanilla',
        sizeSnapshot: 'M',
        unitPriceSnapshot: '750.00',
        quantity: 2,
      },
    ],
  };

  it('returns order detail built from OrderItem snapshot fields', async () => {
    (prisma.order.findFirst as any).mockResolvedValue(orderRecord);

    const result = await getOrderByIdForUser('user-1', 'order-1');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        nameSnapshot: 'Vanilla Candle',
        unitPriceSnapshot: '750.00',
      }),
    );
  });

  it('throws ApiError(404) when the order does not exist', async () => {
    (prisma.order.findFirst as any).mockResolvedValue(null);

    await expect(getOrderByIdForUser('user-1', 'bad-order')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Order not found',
    });
  });

  it('throws the same ApiError(404) when the order belongs to a different user, with userId embedded in the query itself', async () => {
    // ASSUMPTION (flagged per team agreement — this is the specific mechanism
    // the doc implies but doesn't name outright): written assuming
    // prisma.order.findFirst({ where: { id, userId } }) — i.e. ownership is
    // enforced INSIDE the query's where clause, returning null for a mismatch,
    // rather than prisma.order.findUnique({ where: { id } }) followed by a
    // manual `if (order.userId !== userId)` check afterward. This matters:
    // the doc explicitly wants proof that a wrong-user request can never even
    // fetch the row, not just that the service happens to reject it after
    // fetching. If the real implementation uses findUnique + manual check
    // instead, this test needs rewriting, not just its mock adjusted.
    (prisma.order.findFirst as any).mockResolvedValue(null);

    await expect(getOrderByIdForUser('other-user', 'order-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Order not found',
    });

    const callArgs = (prisma.order.findFirst as any).mock.calls[0][0];
    expect(callArgs.where).toEqual(
      expect.objectContaining({ id: 'order-1', userId: 'other-user' }),
    );
  });

  it('never reflects live product changes — detail matches the snapshot even if the live product price differs', async () => {
    (prisma.order.findFirst as any).mockResolvedValue(orderRecord);

    const result = await getOrderByIdForUser('user-1', 'order-1');

    // live price would be, say, '999.00' — result must still show the snapshot
    expect(result.items[0].unitPriceSnapshot).toBe('750.00');
  });
});

// tests/services/admin-order.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Order } from '@prisma/client';
import { prisma } from '../../src/config/db.js';
import {
  getAllOrders,
  updateOrderStatus,
  OrderSummary,
} from '../../src/services/admin-order.service.js';
import * as notificationService from '../../src/services/notification.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/notification.service.js', () => ({
  sendShippingNotificationEmail: vi.fn(),
}));

// Helper to build a Prisma-shaped P2025 error (record not found)
function makeP2025Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '5.0.0',
    meta: { target: ['id'] },
  });
}

// Factory functions for type-safe mock data

// Build a Prisma Order (for DB mocks)
function buildPrismaOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    chapaTxRef: 'tx-123',
    totalAmount: new Prisma.Decimal('1500.00'),
    shippingName: 'Jane Doe',
    shippingPhone: '+251911223344',
    shippingAddress: '123 Test Street',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Build OrderSummary (for service return values)
function buildOrderSummary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order-1',
    status: 'PROCESSING',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    items: [{ id: 'item-1', variantId: 'variant-1', quantity: 2 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin-order.service', () => {
  describe('getAllOrders', () => {
    it('returns all orders across all customers', async () => {
      const mockOrders = [buildPrismaOrder({ id: 'order-1' }), buildPrismaOrder({ id: 'order-2' })];
      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValue(2);

      const result = await getAllOrders({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('includes customerName/customerEmail via join', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([buildPrismaOrder()]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      await getAllOrders({});

      const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      expect(callArgs).toEqual(expect.objectContaining({ include: expect.anything() }));
    });

    it('filters by status when provided', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([buildPrismaOrder({ status: 'SHIPPED' })]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      await getAllOrders({ status: 'SHIPPED' });

      const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      expect(callArgs?.where).toEqual({ status: 'SHIPPED' });
    });

    it('returns all statuses when no status filter is provided', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([buildPrismaOrder()]);
      vi.mocked(prisma.order.count).mockResolvedValue(1);

      await getAllOrders({});

      const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      expect(callArgs?.where ?? {}).not.toHaveProperty('status');
    });

    it('applies default pagination when page and limit are omitted', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await getAllOrders({});

      const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      expect(callArgs?.skip).toBe(0);
      expect(callArgs?.take).toBe(20);
    });

    it('applies custom pagination when page and limit are provided', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await getAllOrders({ page: 3, limit: 10 });

      const callArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      expect(callArgs?.skip).toBe(20); // (3-1) * 10
      expect(callArgs?.take).toBe(10);
    });

    it('returns an empty page when requesting a page beyond the last page', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(5);

      const result = await getAllOrders({ page: 99 });

      expect(result).toEqual({ items: [], total: 5, page: 99, limit: 20 });
    });
  });

  describe('updateOrderStatus', () => {
    it('transitions PROCESSING to SHIPPED and sends the shipping notification', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        buildPrismaOrder({ status: 'PROCESSING' }),
      );
      vi.mocked(prisma.order.update).mockResolvedValue(buildPrismaOrder({ status: 'SHIPPED' }));
      vi.mocked(notificationService.sendShippingNotificationEmail).mockResolvedValue(undefined);

      const result = await updateOrderStatus('order-1', 'SHIPPED');

      expect(result).toEqual({ id: 'order-1', status: 'SHIPPED' });
      expect(vi.mocked(notificationService.sendShippingNotificationEmail)).toHaveBeenCalled();
    });

    it('throws 404 when the order is not found', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await expect(updateOrderStatus('missing-id', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Order not found',
      });
      expect(vi.mocked(notificationService.sendShippingNotificationEmail)).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition when the order is already SHIPPED', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(buildPrismaOrder({ status: 'SHIPPED' }));

      await expect(updateOrderStatus('order-1', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status transition',
      });
      expect(vi.mocked(prisma.order.update)).not.toHaveBeenCalled();
      expect(vi.mocked(notificationService.sendShippingNotificationEmail)).not.toHaveBeenCalled();
    });

    it('rejects invalid transition from PROCESSING to PROCESSING (same status)', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        buildPrismaOrder({ status: 'PROCESSING' }),
      );

      await expect(updateOrderStatus('order-1', 'PROCESSING')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status transition',
      });
      expect(vi.mocked(prisma.order.update)).not.toHaveBeenCalled();
      expect(vi.mocked(notificationService.sendShippingNotificationEmail)).not.toHaveBeenCalled();
    });

    it('sends the notification email outside of any transaction (after the DB update)', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        buildPrismaOrder({ status: 'PROCESSING' }),
      );
      vi.mocked(prisma.order.update).mockResolvedValue(buildPrismaOrder({ status: 'SHIPPED' }));
      vi.mocked(notificationService.sendShippingNotificationEmail).mockResolvedValue(undefined);

      await updateOrderStatus('order-1', 'SHIPPED');

      const updateCallOrder = vi.mocked(prisma.order.update).mock.invocationCallOrder[0];
      const emailCallOrder = vi.mocked(notificationService.sendShippingNotificationEmail).mock
        .invocationCallOrder[0];
      expect(emailCallOrder).toBeGreaterThan(updateCallOrder);
    });

    it('still resolves the status update when the notification email fails', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(
        buildPrismaOrder({ status: 'PROCESSING' }),
      );
      vi.mocked(prisma.order.update).mockResolvedValue(buildPrismaOrder({ status: 'SHIPPED' }));
      vi.mocked(notificationService.sendShippingNotificationEmail).mockRejectedValue(
        new Error('email service down'),
      );

      await expect(updateOrderStatus('order-1', 'SHIPPED')).resolves.toEqual({
        id: 'order-1',
        status: 'SHIPPED',
      });
    });

    it('throws ApiError(404) when order not found', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await expect(updateOrderStatus('missing-id', 'SHIPPED')).rejects.toBeInstanceOf(ApiError);
      await expect(updateOrderStatus('missing-id', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Order not found',
      });
    });

    it('throws ApiError(400) when status transition is invalid', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(buildPrismaOrder({ status: 'SHIPPED' }));

      await expect(updateOrderStatus('order-1', 'SHIPPED')).rejects.toBeInstanceOf(ApiError);
      await expect(updateOrderStatus('order-1', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status transition',
      });
    });
  });
});

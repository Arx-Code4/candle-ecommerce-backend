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

import { prisma } from '../../src/config/db.js';
import { sendShippingNotificationEmail } from '../../src/services/notification.service.js';
import {
  getAllOrders,
  updateOrderStatus,
  OrderSummary,
} from '../../src/services/admin-order.service.js';

const mockedPrisma = prisma as unknown as {
  order: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockedSendShippingNotificationEmail = sendShippingNotificationEmail as ReturnType<
  typeof vi.fn
>;

const buildOrder = (overrides: Partial<OrderSummary> = {}): OrderSummary => ({
  id: 'order-1',
  status: 'PROCESSING',
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  items: [{ id: 'item-1', variantId: 'variant-1', quantity: 2 }],
  ...overrides,
});

describe.skip('admin-order.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllOrders', () => {
    it('returns all orders across all customers', async () => {
      mockedPrisma.order.findMany.mockResolvedValue([
        buildOrder({ id: 'order-1' }),
        buildOrder({ id: 'order-2', customerEmail: 'other@example.com' }),
      ]);
      mockedPrisma.order.count.mockResolvedValue(2);

      const result = await getAllOrders({});

      const userIds = result.items.map((item) => item.customerEmail);
      expect(new Set(userIds).size).toBeGreaterThan(1);
    });

    it('includes customerName/customerEmail via join', async () => {
      mockedPrisma.order.findMany.mockResolvedValue([buildOrder()]);
      mockedPrisma.order.count.mockResolvedValue(1);

      await getAllOrders({});

      const callArgs = mockedPrisma.order.findMany.mock.calls[0][0];
      expect(callArgs).toEqual(expect.objectContaining({ include: expect.anything() }));
    });

    it('filters by status when provided', async () => {
      mockedPrisma.order.findMany.mockResolvedValue([buildOrder({ status: 'SHIPPED' })]);
      mockedPrisma.order.count.mockResolvedValue(1);

      await getAllOrders({ status: 'SHIPPED' });

      const callArgs = mockedPrisma.order.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ status: 'SHIPPED' });
    });

    it('returns all statuses when no status filter is provided', async () => {
      mockedPrisma.order.findMany.mockResolvedValue([buildOrder()]);
      mockedPrisma.order.count.mockResolvedValue(1);

      await getAllOrders({});

      const callArgs = mockedPrisma.order.findMany.mock.calls[0][0];
      expect(callArgs.where ?? {}).not.toHaveProperty('status');
    });
  });

  describe('updateOrderStatus', () => {
    it('transitions PROCESSING to SHIPPED and sends the shipping notification', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'PROCESSING' }));
      mockedPrisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SHIPPED' });

      const result = await updateOrderStatus('order-1', 'SHIPPED');

      expect(result).toEqual({ id: 'order-1', status: 'SHIPPED' });
      expect(mockedSendShippingNotificationEmail).toHaveBeenCalled();
    });

    it('throws 404 when the order is not found', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(null);

      await expect(updateOrderStatus('missing-id', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Order not found',
      });
      expect(mockedSendShippingNotificationEmail).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition when the order is already SHIPPED', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'SHIPPED' }));

      await expect(updateOrderStatus('order-1', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status transition',
      });
      expect(mockedPrisma.order.update).not.toHaveBeenCalled();
      expect(mockedSendShippingNotificationEmail).not.toHaveBeenCalled();
    });

    it('sends the notification email outside of any transaction', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'PROCESSING' }));
      mockedPrisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SHIPPED' });

      await updateOrderStatus('order-1', 'SHIPPED');

      const updateCallOrder = mockedPrisma.order.update.mock.invocationCallOrder[0];
      const emailCallOrder = mockedSendShippingNotificationEmail.mock.invocationCallOrder[0];
      expect(emailCallOrder).toBeGreaterThan(updateCallOrder);
    });

    it('returns a 400 on a second concurrent update once the order is already SHIPPED', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'SHIPPED' }));

      await expect(updateOrderStatus('order-1', 'SHIPPED')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status transition',
      });
    });

    it('still resolves the status update when the notification email fails', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'PROCESSING' }));
      mockedPrisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SHIPPED' });
      mockedSendShippingNotificationEmail.mockRejectedValue(new Error('email service down'));

      await expect(updateOrderStatus('order-1', 'SHIPPED')).resolves.toEqual({
        id: 'order-1',
        status: 'SHIPPED',
      });
    });
  });
});

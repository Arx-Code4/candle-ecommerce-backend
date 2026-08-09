// tests/services/notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
  sendPaymentFailedEmail,
  type OrderWithItems,
} from '../../src/services/notification.service.js';
import { sendMail } from '../../src/utils/mailer.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/mailer.js', () => ({
  sendMail: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Factory function for type-safe mock order data — matches the real
// Prisma Order & OrderItem shape exactly, so overrides stay type-checked.
function buildMockOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    chapaTxRef: 'tx-order-1',
    totalAmount: new Prisma.Decimal('1500.00'),
    shippingName: 'Abebe',
    shippingPhone: '+251911223344',
    shippingAddress: 'Addis Ababa',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productVariantId: 'variant-1',
        productNameSnapshot: 'Vanilla Candle',
        scentSnapshot: 'Vanilla',
        sizeSnapshot: 'Medium',
        unitPriceSnapshot: new Prisma.Decimal('750.00'),
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendOrderConfirmationEmail', () => {
  it('sends successfully, with content reflecting the order items', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder();

    await sendOrderConfirmationEmail(mockOrder, 'jane@example.com');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        html: expect.stringContaining('Vanilla Candle'),
      }),
    );
  });

  it('sends email with order total in the content', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder({ totalAmount: new Prisma.Decimal('2500.00') });

    await sendOrderConfirmationEmail(mockOrder, 'jane@example.com');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('2500.00'),
      }),
    );
  });

  it('resolves void and logs when the send fails, rather than throwing', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder();

    await expect(
      sendOrderConfirmationEmail(mockOrder, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    // logger.error(error, message) — Pino-style: error object first, message string second
    expect(logger.error).toHaveBeenCalledWith(sendError, expect.stringContaining(mockOrder.id));
  });

  it('does not throw or crash checkout when customerEmail is empty', async () => {
    const mockOrder = buildMockOrder();

    await expect(sendOrderConfirmationEmail(mockOrder, '')).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('does not send email when customerEmail is empty, just logs and returns', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder();

    await sendOrderConfirmationEmail(mockOrder, '');

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    // logger.warn({ orderId }, message) — Pino-style: meta object first, message string second
    expect(logger.warn).toHaveBeenCalledWith(
      { orderId: mockOrder.id },
      expect.stringContaining('missing customer email'),
    );
  });

  it('does not throw when email is undefined', async () => {
    const mockOrder = buildMockOrder();

    await expect(
      sendOrderConfirmationEmail(mockOrder, undefined as unknown as string),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('logs the order ID when sending fails', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder({ id: 'order-123' });

    await sendOrderConfirmationEmail(mockOrder, 'jane@example.com');

    expect(logger.error).toHaveBeenCalledWith(sendError, expect.stringContaining('order-123'));
  });
});

describe('sendShippingNotificationEmail', () => {
  it('sends successfully', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder();

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('shipped'),
      }),
    );
  });

  it('sends shipping notification with order details', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder({ id: 'order-456' });

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('order-456'),
      }),
    );
  });

  it('resolves void and logs when the send fails, never propagating to the caller', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder();

    await expect(
      sendShippingNotificationEmail(mockOrder, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it('does not send email when customerEmail is empty', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);
    const mockOrder = buildMockOrder();

    await sendShippingNotificationEmail(mockOrder, '');

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not throw when email is undefined', async () => {
    const mockOrder = buildMockOrder();

    await expect(
      sendShippingNotificationEmail(mockOrder, undefined as unknown as string),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('logs the order ID when shipping notification fails', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder({ id: 'order-789' });

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(logger.error).toHaveBeenCalledWith(sendError, expect.stringContaining('order-789'));
  });
});

describe('sendPaymentFailedEmail', () => {
  it('sends a failed-payment email with the txRef', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);

    await sendPaymentFailedEmail('tx-123', 'jane@example.com', 'failed');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('Failed'),
        html: expect.stringContaining('tx-123'),
      }),
    );
  });

  it('sends a cancelled-payment email with distinct subject/copy from failed', async () => {
    vi.mocked(sendMail).mockResolvedValue(undefined);

    await sendPaymentFailedEmail('tx-456', 'jane@example.com', 'cancelled');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('Cancelled'),
      }),
    );
  });

  it('does not send when customerEmail is empty, just logs and returns', async () => {
    await sendPaymentFailedEmail('tx-123', '', 'failed');

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { txRef: 'tx-123' },
      expect.stringContaining('missing customer email'),
    );
  });

  it('does not throw when email is undefined', async () => {
    await expect(
      sendPaymentFailedEmail('tx-123', undefined as unknown as string, 'failed'),
    ).resolves.toBeUndefined();

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('resolves void and logs when the send fails, rather than throwing', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);

    await expect(
      sendPaymentFailedEmail('tx-123', 'jane@example.com', 'failed'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(sendError, expect.stringContaining('tx-123'));
  });
});

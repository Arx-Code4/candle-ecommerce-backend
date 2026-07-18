// tests/services/notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
} from '../../src/services/notification.service.js';
import { sendMail } from '../../src/utils/mailer.js';
import logger from '../../src/utils/logger.js';
import ApiError from '../../src/utils/ApiError.js';

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

// Factory function for type-safe mock order data
function buildMockOrder(overrides: Partial<any> = {}) {
  return {
    id: 'order-1',
    totalAmount: '1500.00',
    items: [
      {
        name: 'Vanilla Candle',
        quantity: 2,
        unitPriceSnapshot: '750.00',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('sendOrderConfirmationEmail', () => {
  it('sends successfully, with content reflecting the order items', async () => {
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
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
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
    const mockOrder = buildMockOrder({ totalAmount: '2500.00' });

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
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('SMTP connection refused'),
      }),
    );
  });

  it('does not throw or crash checkout when customerEmail is empty', async () => {
    const mockOrder = buildMockOrder();

    await expect(sendOrderConfirmationEmail(mockOrder, '')).resolves.toBeUndefined();

    // Should log a warning for empty email
    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('does not send email when customerEmail is empty, just logs and returns', async () => {
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
    const mockOrder = buildMockOrder();

    await sendOrderConfirmationEmail(mockOrder, '');

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Empty customer email'),
      }),
    );
  });

  it('does not throw when email is undefined', async () => {
    const mockOrder = buildMockOrder();

    await expect(sendOrderConfirmationEmail(mockOrder, undefined as any)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('logs the order ID when sending fails', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder({ id: 'order-123' });

    await sendOrderConfirmationEmail(mockOrder, 'jane@example.com');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-123',
      }),
    );
  });
});

describe.skip('sendShippingNotificationEmail', () => {
  it('sends successfully', async () => {
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
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
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
    const mockOrder = buildMockOrder({ id: 'order-456' });

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('order-456'),
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
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });
    const mockOrder = buildMockOrder();

    await sendShippingNotificationEmail(mockOrder, '');

    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not throw when email is undefined', async () => {
    const mockOrder = buildMockOrder();

    await expect(
      sendShippingNotificationEmail(mockOrder, undefined as any),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });

  it('logs the order ID when shipping notification fails', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);
    const mockOrder = buildMockOrder({ id: 'order-789' });

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-789',
      }),
    );
  });
});

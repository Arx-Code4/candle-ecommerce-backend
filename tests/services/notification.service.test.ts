// tests/services/notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
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

const mockOrder = {
  id: 'order-1',
  totalAmount: '1500.00',
  items: [{ name: 'Vanilla Candle', quantity: 2, unitPriceSnapshot: '750.00' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('sendOrderConfirmationEmail', () => {
  it('sends successfully, with content reflecting the order items', async () => {
    (sendMail as any).mockResolvedValue({ messageId: 'abc123' });

    await sendOrderConfirmationEmail(mockOrder as any, 'jane@example.com');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        html: expect.stringContaining('Vanilla Candle'),
      }),
    );
  });

  it('resolves void and logs when the send fails, rather than throwing', async () => {
    const sendError = new Error('SMTP connection refused');
    (sendMail as any).mockRejectedValue(sendError);

    await expect(
      sendOrderConfirmationEmail(mockOrder as any, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it('does not throw or crash checkout when customerEmail is empty', async () => {
    await expect(sendOrderConfirmationEmail(mockOrder as any, '')).resolves.toBeUndefined();
  });
});

describe.skip('sendShippingNotificationEmail', () => {
  it('sends successfully', async () => {
    (sendMail as any).mockResolvedValue({ messageId: 'abc123' });

    await sendShippingNotificationEmail(mockOrder as any, 'jane@example.com');

    expect(sendMail).toHaveBeenCalled();
  });

  it('resolves void and logs when the send fails, never propagating to the caller', async () => {
    const sendError = new Error('SMTP connection refused');
    (sendMail as any).mockRejectedValue(sendError);

    await expect(
      sendShippingNotificationEmail(mockOrder as any, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});

// tests/services/notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
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

type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}>;

const mockOrder: OrderWithItems = {
  id: 'order-1',
  userId: 'user-1',
  status: 'PROCESSING',
  chapaTxRef: 'tx-ref-1',
  totalAmount: new Prisma.Decimal('1500.00'),
  shippingName: 'Jane Doe',
  shippingPhone: '0911000000',
  shippingAddress: 'Bole, Addis Ababa',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'order-item-1',
      orderId: 'order-1',
      productVariantId: 'variant-1',
      productNameSnapshot: 'Vanilla Candle',
      scentSnapshot: 'vanilla',
      sizeSnapshot: 'large',
      unitPriceSnapshot: new Prisma.Decimal('750.00'),
      quantity: 2,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('sendOrderConfirmationEmail', () => {
  it('sends successfully, with content reflecting the order items', async () => {
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });

    await sendOrderConfirmationEmail(mockOrder, 'jane@example.com');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        html: expect.stringContaining('Vanilla Candle'),
      }),
    );
  });

  it('resolves void and logs when the send fails, rather than throwing', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);

    await expect(
      sendOrderConfirmationEmail(mockOrder, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it('does not throw or crash checkout when customerEmail is empty', async () => {
    await expect(sendOrderConfirmationEmail(mockOrder, '')).resolves.toBeUndefined();
  });
});

describe.skip('sendShippingNotificationEmail', () => {
  it('sends successfully', async () => {
    vi.mocked(sendMail).mockResolvedValue({ messageId: 'abc123' });

    await sendShippingNotificationEmail(mockOrder, 'jane@example.com');

    expect(sendMail).toHaveBeenCalled();
  });

  it('resolves void and logs when the send fails, never propagating to the caller', async () => {
    const sendError = new Error('SMTP connection refused');
    vi.mocked(sendMail).mockRejectedValue(sendError);

    await expect(
      sendShippingNotificationEmail(mockOrder, 'jane@example.com'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});

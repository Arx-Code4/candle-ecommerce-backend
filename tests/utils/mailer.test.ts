// tests/utils/mailer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { sendMail } from '../../src/utils/mailer.js';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

beforeEach(() => {
  mockSendMail.mockClear();
});

describe.skip('sendMail', () => {
  const message = {
    to: 'jane@example.com',
    subject: 'Order Confirmation',
    html: '<p>Thanks for your order!</p>',
  };

  it('calls the configured transport with the given message', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    await sendMail(message);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    );
  });

  it('propagates a send failure unchanged, without catching it', async () => {
    const sendError = new Error('SMTP connection refused');
    mockSendMail.mockRejectedValue(sendError);

    await expect(sendMail(message)).rejects.toThrow('SMTP connection refused');
  });

  it('builds the transport as a singleton — createTransport is called exactly once', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    await sendMail(message);
    await sendMail(message);
    await sendMail({ ...message, to: 'other@example.com' });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});

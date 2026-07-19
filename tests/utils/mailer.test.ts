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

    // Re-import the module to get a fresh instance for this test
    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');
    await freshSendMail(message);

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

    // Re-import the module to get a fresh instance for this test
    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    await expect(freshSendMail(message)).rejects.toThrow('SMTP connection refused');
  });

  it('builds the transport as a singleton — createTransport is called exactly once across multiple calls', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    // Reset modules and re-import to ensure fresh state
    vi.resetModules();
    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    // Call sendMail multiple times
    await freshSendMail(message);
    await freshSendMail({ ...message, to: 'other@example.com' });
    await freshSendMail({ ...message, to: 'third@example.com' });

    // createTransport should only be called once (singleton pattern)
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it('does not call createTransport again after the transport is already built', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    vi.resetModules();
    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    // First call - should create the transport
    await freshSendMail(message);
    const firstCallCount = vi.mocked(nodemailer.createTransport).mock.calls.length;

    // Second call - should reuse the existing transport
    await freshSendMail({ ...message, to: 'other@example.com' });
    const secondCallCount = vi.mocked(nodemailer.createTransport).mock.calls.length;

    // createTransport should still only be called once
    expect(firstCallCount).toBe(1);
    expect(secondCallCount).toBe(1);
  });

  it('handles multiple sendMail calls with different recipients using the same transport', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    vi.resetModules();
    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    await freshSendMail({ to: 'user1@example.com', subject: 'Test', html: '<p>Test 1</p>' });
    await freshSendMail({ to: 'user2@example.com', subject: 'Test', html: '<p>Test 2</p>' });
    await freshSendMail({ to: 'user3@example.com', subject: 'Test', html: '<p>Test 3</p>' });

    // All calls should use the same transport
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });
});

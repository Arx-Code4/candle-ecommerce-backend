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
  vi.clearAllMocks();
  vi.resetModules(); // Add this
});

describe('sendMail', () => {
  const message = {
    to: 'jane@example.com',
    subject: 'Order Confirmation',
    html: '<p>Thanks for your order!</p>',
  };

  it('builds the transport as a singleton — createTransport is called exactly once across multiple calls', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    // Call sendMail multiple times
    await freshSendMail(message);
    await freshSendMail({ ...message, to: 'other@example.com' });
    await freshSendMail({ ...message, to: 'third@example.com' });

    // createTransport should only be called once (singleton pattern)
    expect(vi.mocked(nodemailer.createTransport)).toHaveBeenCalledTimes(1);
  });

  it('does not call createTransport again after the transport is already built', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    await freshSendMail(message);
    const createTransportMock = vi.mocked(nodemailer.createTransport);
    const callCountAfterFirst = createTransportMock.mock.calls.length;

    await freshSendMail({ ...message, to: 'other@example.com' });
    const callCountAfterSecond = createTransportMock.mock.calls.length;

    expect(callCountAfterFirst).toBe(1);
    expect(callCountAfterSecond).toBe(1); // Still 1, not incremented
  });

  it('handles multiple sendMail calls with different recipients using the same transport', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'abc123' });

    const { sendMail: freshSendMail } = await import('../../src/utils/mailer.js');

    await freshSendMail({ to: 'user1@example.com', subject: 'Test', html: '<p>Test 1</p>' });
    await freshSendMail({ to: 'user2@example.com', subject: 'Test', html: '<p>Test 2</p>' });
    await freshSendMail({ to: 'user3@example.com', subject: 'Test', html: '<p>Test 3</p>' });

    expect(vi.mocked(nodemailer.createTransport)).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });
});

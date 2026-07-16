// tests/utils/chapa.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import axios from 'axios';
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from '../../src/utils/chapa.js';
import ApiError from '../../src/utils/ApiError.js';
import { env } from '../../src/config/env.js';

vi.mock('axios');

vi.mock('../../src/config/env.js', () => ({
  env: {
    CHAPA_SECRET_KEY: 'test-secret-key',
    CHAPA_WEBHOOK_SECRET: 'test-webhook-secret',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('initializeTransaction', () => {
  const input = {
    amount: '500.00',
    email: 'jane@example.com',
    txRef: 'tx-123',
    returnUrl: 'https://shop.example.com/order-confirmation',
  };

  it('resolves a checkoutUrl on successful initialization', async () => {
    (axios.post as any).mockResolvedValue({
      data: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/abc' } },
    });

    const result = await initializeTransaction(input);

    expect(result).toEqual({ checkoutUrl: 'https://checkout.chapa.co/abc' });
    const [, , config] = (axios.post as any).mock.calls[0];
    expect(config.headers.Authorization).toBe(`Bearer ${env.CHAPA_SECRET_KEY}`);
  });

  it('throws ApiError(502) on a provider timeout', async () => {
    (axios.post as any).mockRejectedValue(new Error('ECONNABORTED: timeout'));

    await expect(initializeTransaction(input)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to reach payment provider, please try again',
    });
    await expect(initializeTransaction(input)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError(502) on an unexpected response shape (missing checkout_url)', async () => {
    (axios.post as any).mockResolvedValue({ data: { status: 'success', data: {} } });

    await expect(initializeTransaction(input)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to reach payment provider, please try again',
    });
  });

  it('throws the same generic ApiError(502) on a txRef collision, with no special-cased retry', async () => {
    (axios.post as any).mockRejectedValue({
      response: { data: { message: 'txRef already used' } },
    });

    await expect(initializeTransaction(input)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to reach payment provider, please try again',
    });
  });
});

describe.skip('verifyTransaction', () => {
  const txRef = 'tx-123';

  it('resolves the status and amount on successful verification', async () => {
    (axios.get as any).mockResolvedValue({
      data: { status: 'success', data: { status: 'success', amount: '500.00' } },
    });

    const result = await verifyTransaction(txRef);

    expect(result).toEqual({ status: 'success', amount: '500.00' });
  });

  it('throws ApiError(502) when the provider is unreachable', async () => {
    (axios.get as any).mockRejectedValue(new Error('network error'));

    await expect(verifyTransaction(txRef)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to verify payment with provider',
    });
  });

  it('resolves whatever status/amount Chapa reports, without comparing amounts itself', async () => {
    (axios.get as any).mockResolvedValue({
      data: { status: 'success', data: { status: 'failed', amount: '0.00' } },
    });

    const result = await verifyTransaction(txRef);

    expect(result).toEqual({ status: 'failed', amount: '0.00' });
  });
});

describe.skip('verifyWebhookSignature', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', tx_ref: 'tx-123' }));

  function computeValidSignature(): string {
    return crypto.createHmac('sha256', env.CHAPA_WEBHOOK_SECRET).update(rawBody).digest('hex');
  }

  it('returns true for a valid signature', () => {
    const signature = computeValidSignature();

    const result = verifyWebhookSignature(rawBody, signature);

    expect(result).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    const validSignature = computeValidSignature();
    const tampered = validSignature.slice(0, -1) + (validSignature.slice(-1) === 'a' ? 'b' : 'a');

    const result = verifyWebhookSignature(rawBody, tampered);

    expect(result).toBe(false);
  });

  it('returns false, not a throw, when the signature header is missing', () => {
    const result = verifyWebhookSignature(rawBody, undefined as any);

    expect(result).toBe(false);
  });

  it('uses crypto.timingSafeEqual for the comparison, not ===', () => {
    const signature = computeValidSignature();
    const spy = vi.spyOn(crypto, 'timingSafeEqual');

    verifyWebhookSignature(rawBody, signature);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns false, not a throw, when the signature length differs from expected', () => {
    const shortSignature = 'deadbeef';

    const result = verifyWebhookSignature(rawBody, shortSignature);

    expect(result).toBe(false);
  });
});

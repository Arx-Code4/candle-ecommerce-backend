// tests/controllers/checkout.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { initiateCheckout, handleChapaWebhook } from '../../src/controllers/checkout.controller.js';
import * as checkoutService from '../../src/services/checkout.service.js';
import * as chapa from '../../src/utils/chapa.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/checkout.service.js', () => ({
  createChapaSession: vi.fn(),
  confirmChapaPayment: vi.fn(),
}));

vi.mock('../../src/utils/chapa.js', () => ({
  verifyWebhookSignature: vi.fn(),
  verifyTransaction: vi.fn(),
}));

function makeRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('initiateCheckout', () => {
  it('delegates to checkoutService.createChapaSession with user id and body', async () => {
    const shipping = {
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    };
    const serviceResult = { chapaCheckoutUrl: 'https://checkout.chapa.co/abc', txRef: 'tx-123' };
    (checkoutService.createChapaSession as any).mockResolvedValue(serviceResult);

    const req = { user: { id: 'user-1' }, body: shipping } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await initiateCheckout(req, res, next);

    expect(checkoutService.createChapaSession).toHaveBeenCalledWith('user-1', shipping);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'Checkout session created',
        data: serviceResult,
      }),
    );
  });
});

describe.skip('handleChapaWebhook', () => {
  const rawBody = Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'tx-123' }));

  function makeWebhookReq(overrides: Partial<Request> = {}): Request {
    return {
      body: rawBody,
      headers: { 'chapa-signature': 'valid-signature' },
      ...overrides,
    } as unknown as Request;
  }

  it('confirms payment using verifyTransaction status, not the raw payload status', async () => {
    (chapa.verifyWebhookSignature as any).mockReturnValue(true);
    (chapa.verifyTransaction as any).mockResolvedValue({ status: 'success', amount: '1500.00' });
    (checkoutService.confirmChapaPayment as any).mockResolvedValue({
      orderId: 'order-1',
      created: true,
    });

    const req = makeWebhookReq();
    const res = makeRes();
    const next = makeNext();

    await handleChapaWebhook(req, res, next);

    expect(checkoutService.confirmChapaPayment).toHaveBeenCalledWith('tx-123', 'success');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("never trusts the payload's own claimed status — uses verifyTransaction's result even when they disagree", async () => {
    // Raw payload claims "success", but verifyTransaction (the source of truth) says "failed"
    (chapa.verifyWebhookSignature as any).mockReturnValue(true);
    (chapa.verifyTransaction as any).mockResolvedValue({ status: 'failed', amount: '0.00' });
    (checkoutService.confirmChapaPayment as any).mockResolvedValue({ created: false });

    const req = makeWebhookReq(); // body still says status: "success"
    const res = makeRes();
    const next = makeNext();

    await handleChapaWebhook(req, res, next);

    expect(checkoutService.confirmChapaPayment).toHaveBeenCalledWith('tx-123', 'failed');
  });

  it('rejects an invalid signature without touching verifyTransaction or confirmChapaPayment', async () => {
    (chapa.verifyWebhookSignature as any).mockReturnValue(false);

    const req = makeWebhookReq({ headers: { 'chapa-signature': 'tampered' } } as any);
    const res = makeRes();
    const next = makeNext();

    await handleChapaWebhook(req, res, next);

    expect(chapa.verifyTransaction).not.toHaveBeenCalled();
    expect(checkoutService.confirmChapaPayment).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid webhook signature' }),
    );
  });

  it('returns 200 for a duplicate delivery (already processed), so Chapa does not retry', async () => {
    (chapa.verifyWebhookSignature as any).mockReturnValue(true);
    (chapa.verifyTransaction as any).mockResolvedValue({ status: 'success', amount: '1500.00' });
    (checkoutService.confirmChapaPayment as any).mockResolvedValue({
      orderId: 'order-1',
      created: false,
    });

    const req = makeWebhookReq();
    const res = makeRes();
    const next = makeNext();

    await handleChapaWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 for a failed/cancelled status, not an error status', async () => {
    (chapa.verifyWebhookSignature as any).mockReturnValue(true);
    (chapa.verifyTransaction as any).mockResolvedValue({ status: 'failed', amount: '0.00' });
    (checkoutService.confirmChapaPayment as any).mockResolvedValue({ created: false });

    const req = makeWebhookReq();
    const res = makeRes();
    const next = makeNext();

    await handleChapaWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});

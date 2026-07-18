// tests/routes/checkout.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import checkoutRouter from '../../src/routes/checkout.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as checkoutController from '../../src/controllers/checkout.controller.js';
import ApiError from '../../src/utils/ApiError.js';

// Mock the auth middleware to pass for authenticated tests
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

vi.mock('../../src/controllers/checkout.controller.js', () => ({
  initiateCheckout: vi.fn(async (req, res) =>
    res
      .status(200)
      .json({
        statusCode: 200,
        success: true,
        message: 'Checkout session created',
        data: { chapaCheckoutUrl: 'https://checkout.chapa.co/abc', txRef: 'tx-123' },
      }),
  ),
  handleChapaWebhook: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'Webhook received' }),
  ),
}));

function buildTestApp() {
  const app = express();

  // FLAG (unconfirmed assumption): the webhook route needs the raw Buffer
  // body intact for signature verification (see chapa.test.ts's
  // verifyWebhookSignature cases), so this test app applies express.raw()
  // only to the webhook path and express.json() everywhere else.
  //
  // This mirrors what checkout.schema.test.ts's doc note implies ("no
  // validate(...) on the webhook route") and eco-9.2's routes test case
  // ("no JSON parsing intercepts this route before the handler") — but the
  // REAL app might wire raw-body parsing at a different level entirely
  // (e.g. globally in app.ts with a path-based condition, rather than here
  // in checkout.routes.ts). Confirm with whoever implements the real route
  // file, and update this test app's middleware setup to match exactly —
  // otherwise this suite is testing a fictional wiring, not the real one.
  app.use('/checkout', express.json());
  app.use('/payments/chapa/webhook', express.raw({ type: '*/*' }));
  app.use('/', checkoutRouter);
  app.use(errorMiddleware);
  return app;
}

function makeAuthedRequest(app: express.Express) {
  // FLAG (placeholder, not real auth): this fake bearer token only exercises
  // whether authMiddleware is wired to run at all on this route — it does
  // NOT validate real JWT signing/expiry logic. Once authMiddleware actually
  // exists, these "authed" tests may need a real signed test JWT instead,
  // depending on how strict the real middleware turns out to be (e.g. if it
  // verifies signature/expiry rather than just checking header presence).
  return request(app).set('Authorization', 'Bearer fake-valid-token');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('POST /checkout', () => {
  it('requires auth — 401 without a token, controller never invoked', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });

    expect(res.status).toBe(401);
    expect(checkoutController.initiateCheckout).not.toHaveBeenCalled();
  });

  it('validates the shipping body — rejected before the controller on an empty body', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app).post('/checkout').send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
    });
    expect(checkoutController.initiateCheckout).not.toHaveBeenCalled();
  });

  it('validates shipping fields — rejects missing fields', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app).post('/checkout').send({
      shippingName: 'Abebe',
      // Missing shippingPhone and shippingAddress
    });

    expect(res.status).toBe(400);
    expect(checkoutController.initiateCheckout).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid auth header and body', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app).post('/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });

    expect(checkoutController.initiateCheckout).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns 404 when the controller throws ApiError(404)', async () => {
    const initiateCheckoutMock = vi.mocked(checkoutController.initiateCheckout);
    initiateCheckoutMock.mockRejectedValueOnce(new ApiError(404, 'Cart not found'));

    const app = buildTestApp();

    const res = await makeAuthedRequest(app).post('/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      success: false,
      message: 'Cart not found',
      errors: [],
    });
  });

  it('returns 409 when the controller throws ApiError(409)', async () => {
    const initiateCheckoutMock = vi.mocked(checkoutController.initiateCheckout);
    initiateCheckoutMock.mockRejectedValueOnce(
      new ApiError(409, 'Insufficient stock', ['Vanilla Candle: only 0 available']),
    );

    const app = buildTestApp();

    const res = await makeAuthedRequest(app).post('/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      statusCode: 409,
      success: false,
      message: 'Insufficient stock',
      errors: ['Vanilla Candle: only 0 available'],
    });
  });
});

describe.skip('POST /payments/chapa/webhook', () => {
  it('has no auth middleware — reaches the controller without an Authorization header', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'tx-123' })));

    expect(checkoutController.handleChapaWebhook).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('has no JSON body-parsing/validation in the chain — a non-JSON raw buffer still reaches the controller intact', async () => {
    const app = buildTestApp();
    const rawBuffer = Buffer.from('not-json-at-all-just-raw-bytes');

    const res = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/octet-stream')
      .send(rawBuffer);

    expect(checkoutController.handleChapaWebhook).toHaveBeenCalled();
    const [reqArg] = vi.mocked(checkoutController.handleChapaWebhook).mock.calls[0];
    expect(Buffer.isBuffer(reqArg.body)).toBe(true);
  });

  it('returns 400 when verifyWebhookSignature fails', async () => {
    const handleChapaWebhookMock = vi.mocked(checkoutController.handleChapaWebhook);
    handleChapaWebhookMock.mockRejectedValueOnce(new ApiError(400, 'Invalid webhook signature'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'tx-123' })));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      success: false,
      message: 'Invalid webhook signature',
      errors: [],
    });
  });

  it('returns 404 for unknown txRef', async () => {
    const handleChapaWebhookMock = vi.mocked(checkoutController.handleChapaWebhook);
    handleChapaWebhookMock.mockRejectedValueOnce(
      new ApiError(404, 'Unknown transaction reference'),
    );

    const app = buildTestApp();

    const res = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'unknown-tx' })));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      success: false,
      message: 'Unknown transaction reference',
      errors: [],
    });
  });
});

describe.skip('authMiddleware is applied per-route, not router-wide', () => {
  it('/checkout is blocked without auth, but the webhook route is not', async () => {
    const app = buildTestApp();

    const checkoutRes = await request(app).post('/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });
    const webhookRes = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'tx-123' })));

    expect(checkoutRes.status).toBe(401);
    expect(webhookRes.status).toBe(200);
  });
});

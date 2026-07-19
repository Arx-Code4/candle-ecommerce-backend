// tests/routes/checkout.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import checkoutRouter from '../../src/routes/checkout.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as checkoutController from '../../src/controllers/checkout.controller.js';

vi.mock('../../src/controllers/checkout.controller.js', () => ({
  initiateCheckout: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
  handleChapaWebhook: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
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

// FLAG (placeholder, not real auth): this fake bearer token only exercises
// whether authMiddleware is wired to run at all on this route — it does
// NOT validate real JWT signing/expiry logic. Once authMiddleware actually
// exists, these "authed" tests may need a real signed test JWT instead,
// depending on how strict the real middleware turns out to be (e.g. if it
// verifies signature/expiry rather than just checking header presence).
//
// NOTE: signature is (app, method, path) rather than (app) because
// supertest's `request(app)` doesn't expose `.set()` until a verb method
// (`.post()`, `.get()`, etc.) has been called on it — `.set()` only exists
// on the `Test` instance returned by that verb call, not on the bare
// SuperTest agent. Building the verb call inside the helper (instead of
// chaining it after the helper returns) lets us call `.set(...)` here,
// where it's actually available.
function makeAuthedRequest(
  app: express.Express,
  method: 'post' | 'get' | 'put' | 'patch' | 'delete',
  path: string,
) {
  return request(app)[method](path).set('Authorization', 'Bearer fake-valid-token');
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

    const res = await makeAuthedRequest(app, 'post', '/checkout').send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(checkoutController.initiateCheckout).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid auth header and body', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app, 'post', '/checkout').send({
      shippingName: 'Abebe',
      shippingPhone: '+251911223344',
      shippingAddress: 'Addis Ababa',
    });

    expect(checkoutController.initiateCheckout).toHaveBeenCalled();
    expect(res.status).toBe(200);
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
    const [reqArg] = (checkoutController.handleChapaWebhook as any).mock.calls[0];
    expect(Buffer.isBuffer(reqArg.body)).toBe(true);
  });
});

describe.skip('authMiddleware is applied per-route, not router-wide', () => {
  it('/checkout is blocked without auth, but the webhook route is not', async () => {
    const app = buildTestApp();

    const checkoutRes = await request(app).post('/checkout').send({});
    const webhookRes = await request(app)
      .post('/payments/chapa/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ status: 'success', tx_ref: 'tx-123' })));

    expect(checkoutRes.status).toBe(401);
    expect(webhookRes.status).toBeGreaterThanOrEqual(200);
    expect(webhookRes.status).toBeLessThan(300);
  });
});

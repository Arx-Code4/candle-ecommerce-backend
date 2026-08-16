// tests/routes/order.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import orderRouter from '../../src/routes/order.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as orderController from '../../src/controllers/order.controller.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

vi.mock('../../src/controllers/order.controller.js', () => ({
  listMyOrders: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: [] }),
  ),
  getMyOrderById: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: {} }),
  ),
}));

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/orders', orderRouter);
  app.use(errorMiddleware);
  return app;
}

function makeAuthedRequest(
  app: express.Express,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
) {
  return request(app)[method](path).set('Authorization', 'Bearer fake-valid-token');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /orders', () => {
  it('requires auth — 401 without a token, controller never invoked', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/orders');

    expect(res.status).toBe(401);
    expect(orderController.listMyOrders).not.toHaveBeenCalled();
  });

  it('calls listMyOrders when authenticated', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app, 'get', '/orders');

    expect(res.status).toBe(200);
    expect(orderController.listMyOrders).toHaveBeenCalled();
  });
});

describe('GET /orders/:id', () => {
  it('validates UUID format and returns 400 for malformed id', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app, 'get', '/orders/not-a-valid-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      errors: expect.arrayContaining([expect.stringContaining('Invalid ID format')]),
    });
    expect(orderController.getMyOrderById).not.toHaveBeenCalled();
  });

  it('validates UUID format before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await makeAuthedRequest(app, 'get', '/orders/not-a-valid-uuid');

    expect(res.status).toBe(400); // Expects validation error, not 401
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      errors: expect.arrayContaining([expect.stringContaining('Invalid ID format')]),
    });
    expect(orderController.getMyOrderById).not.toHaveBeenCalled();
  });
});

describe('authMiddleware applies to every route in this router', () => {
  it('both GET / and GET /:id pass auth with mocked middleware', async () => {
    const app = buildTestApp();

    const listRes = await makeAuthedRequest(app, 'get', '/orders');
    const detailRes = await makeAuthedRequest(
      app,
      'get',
      '/orders/3fa85f64-5717-4562-b3fc-2c963f66afa6',
    );
    expect(listRes.status).toBe(200);
    expect(detailRes.status).toBe(200);
    expect(orderController.listMyOrders).toHaveBeenCalled();
    expect(orderController.getMyOrderById).toHaveBeenCalled();
  });
});

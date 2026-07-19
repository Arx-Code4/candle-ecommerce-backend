// tests/routes/order.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import orderRouter from '../../src/routes/order.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as orderController from '../../src/controllers/order.controller.js';

vi.mock('../../src/controllers/order.controller.js', () => ({
  listMyOrders: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
  getMyOrderById: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
}));

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/orders', orderRouter);
  app.use(errorMiddleware);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('GET /orders', () => {
  it('requires auth — 401 without a token, controller never invoked', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/orders');

    expect(res.status).toBe(401);
    expect(orderController.listMyOrders).not.toHaveBeenCalled();
  });
});

describe.skip('GET /orders/:id', () => {
  it('requires auth — 401 without a token, controller never invoked', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/orders/order-1');

    expect(res.status).toBe(401);
    expect(orderController.getMyOrderById).not.toHaveBeenCalled();
  });
});

describe.skip('authMiddleware applies to every route in this router', () => {
  it('both GET / and GET /:id return 401 without auth', async () => {
    const app = buildTestApp();

    const listRes = await request(app).get('/orders');
    const detailRes = await request(app).get('/orders/order-1');

    expect(listRes.status).toBe(401);
    expect(detailRes.status).toBe(401);
  });
});

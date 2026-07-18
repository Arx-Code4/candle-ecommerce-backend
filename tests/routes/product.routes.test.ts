// tests/routes/product.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import productRouter from '../../src/routes/product.routes.js';
import * as productController from '../../src/controllers/product.controller.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/controllers/product.controller.js', () => ({
  listProducts: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: [] }),
  ),
  getProductById: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: {} }),
  ),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/products', productRouter);
  app.use(errorMiddleware);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('product.routes', () => {
  it('GET / has no auth requirement', async () => {
    const app = buildApp();

    const res = await request(app).get('/products');

    expect(res.status).toBe(200);
    expect(productController.listProducts).toHaveBeenCalled();
  });

  it('GET / rejects invalid query params before reaching the controller', async () => {
    const app = buildApp();

    const res = await request(app).get('/products').query({ limit: 999 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
    });
    expect(productController.listProducts).not.toHaveBeenCalled();
  });

  it('GET / accepts valid query params', async () => {
    const app = buildApp();

    const res = await request(app).get('/products').query({ page: 2, limit: 10 });

    expect(res.status).toBe(200);
    expect(productController.listProducts).toHaveBeenCalled();
  });

  it('GET /:id has no auth requirement', async () => {
    const app = buildApp();
    const validUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const res = await request(app).get(`/products/${validUuid}`);

    expect(res.status).toBe(200);
    expect(productController.getProductById).toHaveBeenCalled();
  });

  // UPDATED: This test now expects 400 instead of reaching the controller
  it('GET /:id validates UUID format and returns 400 for malformed id', async () => {
    const app = buildApp();

    const res = await request(app).get('/products/not-a-valid-uuid');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
      message: expect.stringContaining('Invalid ID format'),
    });
    expect(productController.getProductById).not.toHaveBeenCalled();
  });

  it('GET /:id passes valid UUID to controller', async () => {
    const app = buildApp();
    const validUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    await request(app).get(`/products/${validUuid}`);

    expect(productController.getProductById).toHaveBeenCalled();
  });

  it('GET /:id returns 404 when valid UUID does not exist', async () => {
    const getProductByIdMock = vi.mocked(productController.getProductById);
    getProductByIdMock.mockImplementationOnce(async (req, res) => {
      res.status(404).json({ statusCode: 404, success: false, message: 'Product not found' });
    });

    const app = buildApp();
    const validUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const res = await request(app).get(`/products/${validUuid}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Product not found');
  });

  it('returns 500 for unexpected errors', async () => {
    const getProductByIdMock = vi.mocked(productController.getProductById);
    getProductByIdMock.mockRejectedValueOnce(new Error('Unexpected DB error'));

    const app = buildApp();
    const validUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const res = await request(app).get(`/products/${validUuid}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(500);
  });
});

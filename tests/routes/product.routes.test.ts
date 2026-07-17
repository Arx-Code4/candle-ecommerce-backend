import express from 'express';
import request from 'supertest';
import productRouter from '../../src/routes/product.routes.js';
import * as productController from '../../src/controllers/product.controller.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';

vi.mock('../../src/controllers/product.controller.js', () => ({
  listProducts: vi.fn((req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: [] }),
  ),
  getProductById: vi.fn((req, res) =>
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
  });

  it('GET / rejects invalid query params before reaching the controller', async () => {
    const app = buildApp();

    const res = await request(app).get('/products').query({ limit: 999 });

    expect(res.status).toBe(400);
    expect(productController.listProducts).not.toHaveBeenCalled();
  });

  it('GET /:id has no auth requirement', async () => {
    const app = buildApp();

    const res = await request(app).get('/products/some-id');

    expect(res.status).toBe(200);
  });

  it('GET /:id skips schema validation and reaches the controller even with a malformed id', async () => {
    const app = buildApp();

    await request(app).get('/products/not-a-valid-uuid');

    expect(productController.getProductById).toHaveBeenCalled();
  });
});

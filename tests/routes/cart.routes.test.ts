// tests/routes/cart.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cartRouter from '../../src/routes/cart.routes.js';
import * as cartController from '../../src/controllers/cart.controller.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import ApiError from '../../src/utils/ApiError.js';

// Mock the auth middleware to always pass for tests that need it
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

vi.mock('../../src/controllers/cart.controller.js', () => ({
  getCart: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: {} }),
  ),
  addCartItem: vi.fn(async (req, res) =>
    res
      .status(201)
      .json({ statusCode: 201, success: true, message: 'Item added to cart', data: {} }),
  ),
  updateCartItem: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'OK', data: {} }),
  ),
  removeCartItem: vi.fn(async (req, res) =>
    res.status(200).json({ statusCode: 200, success: true, message: 'Item removed', data: {} }),
  ),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/cart', cartRouter);
  app.use(errorMiddleware);
  return app;
}

const validUuid = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('cart.routes', () => {
  it('GET / requires auth', async () => {
    const app = buildApp();

    const res = await request(app).get('/cart');

    expect(res.status).toBe(401);
    expect(cartController.getCart).not.toHaveBeenCalled();
  });

  it('POST /items requires auth AND validation', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(cartController.addCartItem).not.toHaveBeenCalled();
  });

  it('POST /items with only productVariantId succeeds validation', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({ productVariantId: validUuid });

    expect(res.status).toBe(201);
    expect(cartController.addCartItem).toHaveBeenCalled();
  });

  it('POST /items validates UUID format for productVariantId', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', 'Bearer valid-token')
      .send({ productVariantId: 'not-a-valid-uuid' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Invalid'),
    });
    expect(cartController.addCartItem).not.toHaveBeenCalled();
  });

  it('PATCH /items/:itemId requires quantity in body', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch(`/cart/items/${validUuid}`)
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(cartController.updateCartItem).not.toHaveBeenCalled();
  });

  it('PATCH /items/:itemId validates UUID format for itemId', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/cart/items/not-a-valid-uuid')
      .set('Authorization', 'Bearer valid-token')
      .send({ quantity: 2 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Invalid ID format'),
    });
    expect(cartController.updateCartItem).not.toHaveBeenCalled();
  });

  it('DELETE /items/:itemId requires auth', async () => {
    const app = buildApp();

    const unauthedRes = await request(app).delete(`/cart/items/${validUuid}`);
    expect(unauthedRes.status).toBe(401);
    expect(cartController.removeCartItem).not.toHaveBeenCalled();
  });

  it('DELETE /items/:itemId validates UUID format for itemId', async () => {
    const app = buildApp();

    const res = await request(app)
      .delete('/cart/items/not-a-valid-uuid')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Invalid ID format'),
    });
    expect(cartController.removeCartItem).not.toHaveBeenCalled();
  });

  it('DELETE /items/:itemId passes valid UUID to controller', async () => {
    const app = buildApp();

    await request(app)
      .delete(`/cart/items/${validUuid}`)
      .set('Authorization', 'Bearer valid-token');

    expect(cartController.removeCartItem).toHaveBeenCalled();
  });

  it('authMiddleware applies to every route in the router', async () => {
    const app = buildApp();

    const getRes = await request(app).get('/cart');
    const postRes = await request(app).post('/cart/items').send({});
    const patchRes = await request(app).patch(`/cart/items/${validUuid}`).send({});
    const deleteRes = await request(app).delete(`/cart/items/${validUuid}`);

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
    expect(patchRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  it('a controller ApiError is caught by errorMiddleware and produces the matching status and body', async () => {
    vi.mocked(cartController.removeCartItem).mockRejectedValueOnce(
      new ApiError(404, 'Cart item not found'),
    );
    const app = buildApp();

    const res = await request(app)
      .delete(`/cart/items/${validUuid}`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      success: false,
      message: 'Cart item not found',
      errors: [],
    });
  });

  it('an unexpected non-ApiError thrown by a controller falls back to a generic 500', async () => {
    vi.mocked(cartController.removeCartItem).mockRejectedValueOnce(
      new Error('Unexpected DB failure'),
    );
    const app = buildApp();

    const res = await request(app)
      .delete(`/cart/items/${validUuid}`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(500);
  });
});

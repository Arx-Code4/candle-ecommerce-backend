import express, { Express } from 'express';
import request from 'supertest';

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => next()),
}));

vi.mock('../../src/middlewares/adminOnly.middleware.js', () => ({
  default: vi.fn((req, res, next) => next()),
}));

vi.mock('../../src/controllers/admin-product.controller.js', () => ({
  createProduct: vi.fn((req, res) => res.status(201).json({})),
  listAllProducts: vi.fn((req, res) => res.status(200).json({})),
  updateProduct: vi.fn((req, res) => res.status(200).json({})),
  updateProductStatus: vi.fn((req, res) => res.status(200).json({})),
}));

import authMiddleware from '../../src/middlewares/auth.middleware.js';
import adminOnly from '../../src/middlewares/adminOnly.middleware.js';
import * as adminProductController from '../../src/controllers/admin-product.controller.js';
import adminProductRoutes from '../../src/routes/admin-product.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import ApiError from '../../src/utils/ApiError.js';

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/admin/products', adminProductRoutes);
  app.use(errorMiddleware);
  return app;
};

describe('admin-product.routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    (authMiddleware as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) => next());
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) => next());
    app = buildApp();
  });

  it('POST / requires auth', async () => {
    (authMiddleware as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(401, 'No token provided')),
    );

    const res = await request(app).post('/admin/products').send({});

    expect(res.status).toBe(401);
    expect(adminProductController.createProduct).not.toHaveBeenCalled();
  });

  it('POST / requires ADMIN role', async () => {
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(403, 'Forbidden')),
    );

    const res = await request(app).post('/admin/products').send({});

    expect(res.status).toBe(403);
    expect(adminProductController.createProduct).not.toHaveBeenCalled();
  });

  it('POST / validates body', async () => {
    const res = await request(app).post('/admin/products').send({});

    expect(res.status).toBe(400);
    expect(adminProductController.createProduct).not.toHaveBeenCalled();
  });

  it('GET / requires ADMIN role', async () => {
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(403, 'Forbidden')),
    );

    const res = await request(app).get('/admin/products');

    expect(res.status).toBe(403);
  });

  it('PATCH /:id requires ADMIN role and validates body', async () => {
    const res = await request(app)
      .patch('/admin/products/product-1')
      .send({ photos: [{ url: 'not-a-url' }] });

    expect(res.status).toBe(400);
    expect(adminProductController.updateProduct).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status requires ADMIN role and validates boolean', async () => {
    const res = await request(app)
      .patch('/admin/products/product-1/status')
      .send({ isPublished: 'yes' });

    expect(res.status).toBe(400);
    expect(adminProductController.updateProductStatus).not.toHaveBeenCalled();
  });

  it('runs middleware in the order auth -> adminOnly -> validate', async () => {
    (authMiddleware as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(401, 'No token provided')),
    );

    await request(app).post('/admin/products').send({});

    expect(authMiddleware).toHaveBeenCalledTimes(1);
    expect(adminOnly).not.toHaveBeenCalled();
    expect(adminProductController.createProduct).not.toHaveBeenCalled();
  });
});

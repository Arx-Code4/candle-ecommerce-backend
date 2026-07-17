import express, { Express } from 'express';
import request from 'supertest';

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => next()),
}));

vi.mock('../../src/middlewares/adminOnly.middleware.js', () => ({
  default: vi.fn((req, res, next) => next()),
}));

vi.mock('../../src/controllers/admin-order.controller.js', () => ({
  listAllOrders: vi.fn((req, res) => res.status(200).json({})),
  updateOrderStatus: vi.fn((req, res) => res.status(200).json({})),
}));

import authMiddleware from '../../src/middlewares/auth.middleware.js';
import adminOnly from '../../src/middlewares/adminOnly.middleware.js';
import * as adminOrderController from '../../src/controllers/admin-order.controller.js';
import adminOrderRoutes from '../../src/routes/admin-order.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import ApiError from '../../src/utils/ApiError.js';

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/admin/orders', adminOrderRoutes);
  app.use(errorMiddleware);
  return app;
};

describe.skip('admin-order.routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    (authMiddleware as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) => next());
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) => next());
    app = buildApp();
  });

  it('GET / requires auth', async () => {
    (authMiddleware as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(401, 'No token provided')),
    );

    const res = await request(app).get('/admin/orders');

    expect(res.status).toBe(401);
    expect(adminOrderController.listAllOrders).not.toHaveBeenCalled();
  });

  it('GET / requires ADMIN role', async () => {
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(403, 'Forbidden')),
    );

    const res = await request(app).get('/admin/orders');

    expect(res.status).toBe(403);
    expect(adminOrderController.listAllOrders).not.toHaveBeenCalled();
  });

  it('GET / validates query status enum', async () => {
    const res = await request(app).get('/admin/orders').query({ status: 'DELIVERED' });

    expect(res.status).toBe(400);
    expect(adminOrderController.listAllOrders).not.toHaveBeenCalled();
  });

  it('PATCH /:id/status requires ADMIN role', async () => {
    (adminOnly as ReturnType<typeof vi.fn>).mockImplementation((req, res, next) =>
      next(new ApiError(403, 'Forbidden')),
    );

    const res = await request(app)
      .patch('/admin/orders/order-1/status')
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(403);
  });

  it('PATCH /:id/status rejects a body targeting PROCESSING', async () => {
    const res = await request(app)
      .patch('/admin/orders/order-1/status')
      .send({ status: 'PROCESSING' });

    expect(res.status).toBe(400);
    expect(adminOrderController.updateOrderStatus).not.toHaveBeenCalled();
  });
});

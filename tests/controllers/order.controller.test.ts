// tests/controllers/order.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { listMyOrders, getMyOrderById } from '../../src/controllers/order.controller.js';
import * as orderService from '../../src/services/order.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/order.service.js', () => ({
  getOrdersByUser: vi.fn(),
  getOrderByIdForUser: vi.fn(),
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

describe.skip('listMyOrders', () => {
  it('delegates to orderService.getOrdersByUser with req.user.id', async () => {
    const orders = [{ id: 'order-1', status: 'PROCESSING', totalAmount: '1500.00', itemCount: 2 }];
    (orderService.getOrdersByUser as any).mockResolvedValue(orders);

    const req = { user: { id: 'user-1' } } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await listMyOrders(req, res, next);

    expect(orderService.getOrdersByUser).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'OK',
        data: { items: orders },
      }),
    );
  });
});

describe.skip('getMyOrderById', () => {
  it('delegates to orderService.getOrderByIdForUser with req.user.id and req.params.id', async () => {
    const order = { id: 'order-1', status: 'PROCESSING', totalAmount: '1500.00', items: [] };
    (orderService.getOrderByIdForUser as any).mockResolvedValue(order);

    const req = {
      user: { id: 'user-1' },
      params: { id: 'order-1' },
    } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await getMyOrderById(req, res, next);

    expect(orderService.getOrderByIdForUser).toHaveBeenCalledWith('user-1', 'order-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'OK', data: order }),
    );
  });

  it('propagates a 404 from the service via asyncHandler, without swallowing it', async () => {
    const notFoundError = new ApiError(404, 'Order not found');
    (orderService.getOrderByIdForUser as any).mockRejectedValue(notFoundError);

    const req = {
      user: { id: 'user-1' },
      params: { id: 'bad-order' },
    } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await getMyOrderById(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(res.json).not.toHaveBeenCalled();
  });
});

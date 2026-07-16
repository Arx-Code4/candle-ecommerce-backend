import { Request, Response, NextFunction } from 'express';

vi.mock('../../src/services/admin-order.service.js', () => ({
  getAllOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

import * as adminOrderService from '../../src/services/admin-order.service.js';
import { listAllOrders, updateOrderStatus } from '../../src/controllers/admin-order.controller.js';
import asyncHandler from '../../src/utils/asyncHandler.js';

const buildRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe.skip('admin-order.controller', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    res = buildRes();
    next = vi.fn();
  });

  it('listAllOrders delegates to the service and responds 200', async () => {
    const page = { items: [], page: 1, limit: 20, total: 0 };
    (adminOrderService.getAllOrders as ReturnType<typeof vi.fn>).mockResolvedValue(page);
    const req = { query: { status: 'SHIPPED' } } as unknown as Request;

    await listAllOrders(req, res, next);

    expect(adminOrderService.getAllOrders).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'OK', data: page }),
    );
  });

  it('updateOrderStatus delegates to the service and responds 200', async () => {
    const status = { id: 'order-1', status: 'SHIPPED' };
    (adminOrderService.updateOrderStatus as ReturnType<typeof vi.fn>).mockResolvedValue(status);
    const req = { params: { id: 'order-1' }, body: { status: 'SHIPPED' } } as unknown as Request;

    await updateOrderStatus(req, res, next);

    expect(adminOrderService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'SHIPPED');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'Order status updated', data: status }),
    );
  });

  it('propagates service errors unchanged via next', async () => {
    const error = { statusCode: 400, message: 'Invalid status transition' };
    (adminOrderService.updateOrderStatus as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const req = { params: { id: 'order-1' }, body: { status: 'SHIPPED' } } as unknown as Request;

    await asyncHandler(updateOrderStatus)(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// tests/controllers/admin-order.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as adminOrderService from '../../src/services/admin-order.service.js';
import { listAllOrders, updateOrderStatus } from '../../src/controllers/admin-order.controller.js';
import asyncHandler from '../../src/utils/asyncHandler.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/admin-order.service.js', () => ({
  getAllOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

// Helper to build a mock Response object
function buildRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// Factory functions for mock data
function buildPaginatedResult(overrides: Partial<any> = {}) {
  return {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    ...overrides,
  };
}

function buildOrderStatusResult(overrides: Partial<any> = {}) {
  return {
    id: 'order-1',
    status: 'SHIPPED',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('admin-order.controller', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    res = buildRes();
    next = vi.fn();
  });

  describe('listAllOrders', () => {
    it('delegates to the service and responds 200 with paginated data', async () => {
      const page = buildPaginatedResult({ items: [{ id: 'order-1' }], total: 1 });
      vi.mocked(adminOrderService.getAllOrders).mockResolvedValue(page);
      const req = { query: { status: 'SHIPPED' } } as unknown as Request;

      await listAllOrders(req, res, next);

      expect(vi.mocked(adminOrderService.getAllOrders)).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          message: 'OK',
          data: page,
        }),
      );
    });

    it('handles empty query parameters gracefully', async () => {
      const page = buildPaginatedResult();
      vi.mocked(adminOrderService.getAllOrders).mockResolvedValue(page);
      const req = { query: {} } as unknown as Request;

      await listAllOrders(req, res, next);

      expect(vi.mocked(adminOrderService.getAllOrders)).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes status filter to service when provided', async () => {
      const page = buildPaginatedResult();
      vi.mocked(adminOrderService.getAllOrders).mockResolvedValue(page);
      const req = { query: { status: 'PROCESSING' } } as unknown as Request;

      await listAllOrders(req, res, next);

      expect(vi.mocked(adminOrderService.getAllOrders)).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PROCESSING' }),
      );
    });

    it('propagates service errors via next', async () => {
      const error = new ApiError(500, 'Database error');
      vi.mocked(adminOrderService.getAllOrders).mockRejectedValue(error);
      const req = { query: {} } as unknown as Request;

      await asyncHandler(listAllOrders)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('updateOrderStatus', () => {
    it('delegates to the service and responds 200 with updated status', async () => {
      const status = buildOrderStatusResult({ id: 'order-1', status: 'SHIPPED' });
      vi.mocked(adminOrderService.updateOrderStatus).mockResolvedValue(status);
      const req = {
        params: { id: 'order-1' },
        body: { status: 'SHIPPED' },
      } as unknown as Request;

      await updateOrderStatus(req, res, next);

      expect(vi.mocked(adminOrderService.updateOrderStatus)).toHaveBeenCalledWith(
        'order-1',
        'SHIPPED',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          message: 'Order status updated',
          data: status,
        }),
      );
    });

    it('handles transition from PROCESSING to SHIPPED', async () => {
      const status = buildOrderStatusResult({ id: 'order-1', status: 'SHIPPED' });
      vi.mocked(adminOrderService.updateOrderStatus).mockResolvedValue(status);
      const req = {
        params: { id: 'order-1' },
        body: { status: 'SHIPPED' },
      } as unknown as Request;

      await updateOrderStatus(req, res, next);

      expect(vi.mocked(adminOrderService.updateOrderStatus)).toHaveBeenCalledWith(
        'order-1',
        'SHIPPED',
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('propagates 404 service error when order not found', async () => {
      const error = new ApiError(404, 'Order not found');
      vi.mocked(adminOrderService.updateOrderStatus).mockRejectedValue(error);
      const req = {
        params: { id: 'missing-id' },
        body: { status: 'SHIPPED' },
      } as unknown as Request;

      await asyncHandler(updateOrderStatus)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates 400 service error when status transition is invalid', async () => {
      const error = new ApiError(400, 'Invalid status transition');
      vi.mocked(adminOrderService.updateOrderStatus).mockRejectedValue(error);
      const req = {
        params: { id: 'order-1' },
        body: { status: 'PROCESSING' },
      } as unknown as Request;

      await asyncHandler(updateOrderStatus)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates service errors unchanged via next (non-ApiError)', async () => {
      const error = new Error('Unexpected database failure');
      vi.mocked(adminOrderService.updateOrderStatus).mockRejectedValue(error);
      const req = {
        params: { id: 'order-1' },
        body: { status: 'SHIPPED' },
      } as unknown as Request;

      await asyncHandler(updateOrderStatus)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

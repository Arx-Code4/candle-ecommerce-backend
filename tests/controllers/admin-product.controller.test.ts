import { Request, Response, NextFunction } from 'express';

vi.mock('../../src/services/admin-product.service.js', () => ({
  createProduct: vi.fn(),
  getAllProducts: vi.fn(),
  updateProduct: vi.fn(),
  setProductPublishStatus: vi.fn(),
}));

import * as adminProductService from '../../src/services/admin-product.service.js';
import {
  createProduct,
  listAllProducts,
  updateProduct,
  updateProductStatus,
} from '../../src/controllers/admin-product.controller.js';
import asyncHandler from '../../src/utils/asyncHandler.js';

const buildRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe.skip('admin-product.controller', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    res = buildRes();
    next = vi.fn();
  });

  it('createProduct delegates to the service and responds 201', async () => {
    const product = { id: 'product-1' };
    (adminProductService.createProduct as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    const req = { body: { name: 'Vanilla Bliss' } } as Request;

    await createProduct(req, res, next);

    expect(adminProductService.createProduct).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 201, message: 'Product created', data: product }),
    );
  });

  it('listAllProducts delegates to the service and responds 200', async () => {
    const page = { items: [], page: 1, limit: 20, total: 0 };
    (adminProductService.getAllProducts as ReturnType<typeof vi.fn>).mockResolvedValue(page);
    const req = { query: { page: '1' } } as unknown as Request;

    await listAllProducts(req, res, next);

    expect(adminProductService.getAllProducts).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'OK', data: page }),
    );
  });

  it('updateProduct delegates to the service and responds 200', async () => {
    const product = { id: 'product-1' };
    (adminProductService.updateProduct as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    const req = { params: { id: 'product-1' }, body: { name: 'New Name' } } as unknown as Request;

    await updateProduct(req, res, next);

    expect(adminProductService.updateProduct).toHaveBeenCalledWith('product-1', req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updateProductStatus delegates to the service and responds 200', async () => {
    const status = { id: 'product-1', isPublished: true };
    (adminProductService.setProductPublishStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      status,
    );
    const req = { params: { id: 'product-1' }, body: { isPublished: true } } as unknown as Request;

    await updateProductStatus(req, res, next);

    expect(adminProductService.setProductPublishStatus).toHaveBeenCalledWith('product-1', true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'Product status updated', data: status }),
    );
  });

  it('propagates service errors unchanged via next', async () => {
    const error = { statusCode: 404, message: 'Product not found' };
    (adminProductService.updateProduct as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const req = { params: { id: 'missing-id' }, body: {} } as unknown as Request;

    await asyncHandler(updateProduct)(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

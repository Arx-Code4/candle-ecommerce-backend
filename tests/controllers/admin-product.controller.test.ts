// tests/controllers/admin-product.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as adminProductService from '../../src/services/admin-product.service.js';
import {
  createProduct,
  listAllProducts,
  updateProduct,
  updateProductStatus,
} from '../../src/controllers/admin-product.controller.js';
import asyncHandler from '../../src/utils/asyncHandler.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/admin-product.service.js', () => ({
  createProduct: vi.fn(),
  getAllProducts: vi.fn(),
  updateProduct: vi.fn(),
  setProductPublishStatus: vi.fn(),
}));

// Helper to build a mock Response object
function buildRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// Factory functions for mock data
function buildProductResult(overrides: Partial<any> = {}) {
  return {
    id: 'product-1',
    name: 'Vanilla Bliss',
    description: 'A warm vanilla candle',
    price: 19.99,
    isPublished: false,
    photos: [{ id: 'photo-1', url: 'https://example.com/photo.jpg', sortOrder: 0 }],
    variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
    ...overrides,
  };
}

function buildPaginatedResult(overrides: Partial<any> = {}) {
  return {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    ...overrides,
  };
}

function buildPublishStatusResult(overrides: Partial<any> = {}) {
  return {
    id: 'product-1',
    isPublished: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin-product.controller', () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    res = buildRes();
    next = vi.fn();
  });

  describe('createProduct', () => {
    it('delegates to the service and responds 201 with created product', async () => {
      const product = buildProductResult();
      vi.mocked(adminProductService.createProduct).mockResolvedValue(product);
      const req = { body: { name: 'Vanilla Bliss', price: 19.99 } } as Request;

      await createProduct(req, res, next);

      expect(vi.mocked(adminProductService.createProduct)).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 201,
          success: true,
          message: 'Product created',
          data: product,
        }),
      );
    });

    it('handles product creation with photos and variants', async () => {
      const product = buildProductResult({
        photos: [{ id: 'photo-1', url: 'https://example.com/photo.jpg', sortOrder: 0 }],
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
      });
      vi.mocked(adminProductService.createProduct).mockResolvedValue(product);
      const req = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      } as Request;

      await createProduct(req, res, next);

      expect(vi.mocked(adminProductService.createProduct)).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('propagates 400 service error when validation fails', async () => {
      const error = new ApiError(400, 'Duplicate scent/size combination');
      vi.mocked(adminProductService.createProduct).mockRejectedValue(error);
      const req = { body: { name: 'Vanilla Bliss' } } as Request;

      await asyncHandler(createProduct)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates non-ApiError service errors unchanged', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(adminProductService.createProduct).mockRejectedValue(error);
      const req = { body: { name: 'Vanilla Bliss' } } as Request;

      await asyncHandler(createProduct)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listAllProducts', () => {
    it('delegates to the service and responds 200 with paginated data', async () => {
      const page = buildPaginatedResult({ items: [{ id: 'product-1' }], total: 1 });
      vi.mocked(adminProductService.getAllProducts).mockResolvedValue(page);
      const req = { query: { page: '1' } } as unknown as Request;

      await listAllProducts(req, res, next);

      expect(vi.mocked(adminProductService.getAllProducts)).toHaveBeenCalledWith(req.query);
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

    it('handles empty query parameters', async () => {
      const page = buildPaginatedResult();
      vi.mocked(adminProductService.getAllProducts).mockResolvedValue(page);
      const req = { query: {} } as unknown as Request;

      await listAllProducts(req, res, next);

      expect(vi.mocked(adminProductService.getAllProducts)).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes pagination parameters to service', async () => {
      const page = buildPaginatedResult();
      vi.mocked(adminProductService.getAllProducts).mockResolvedValue(page);
      const req = { query: { page: '2', limit: '10' } } as unknown as Request;

      await listAllProducts(req, res, next);

      expect(vi.mocked(adminProductService.getAllProducts)).toHaveBeenCalledWith(
        expect.objectContaining({ page: '2', limit: '10' }),
      );
    });

    it('propagates service errors via next', async () => {
      const error = new ApiError(500, 'Database error');
      vi.mocked(adminProductService.getAllProducts).mockRejectedValue(error);
      const req = { query: {} } as unknown as Request;

      await asyncHandler(listAllProducts)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('delegates to the service and responds 200 with updated product', async () => {
      const product = buildProductResult({ name: 'New Name' });
      vi.mocked(adminProductService.updateProduct).mockResolvedValue(product);
      const req = {
        params: { id: 'product-1' },
        body: { name: 'New Name' },
      } as unknown as Request;

      await updateProduct(req, res, next);

      expect(vi.mocked(adminProductService.updateProduct)).toHaveBeenCalledWith(
        'product-1',
        req.body,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          message: 'Product updated',
          data: product,
        }),
      );
    });

    it('handles partial updates (only name)', async () => {
      const product = buildProductResult({ name: 'Updated Name' });
      vi.mocked(adminProductService.updateProduct).mockResolvedValue(product);
      const req = {
        params: { id: 'product-1' },
        body: { name: 'Updated Name' },
      } as unknown as Request;

      await updateProduct(req, res, next);

      expect(vi.mocked(adminProductService.updateProduct)).toHaveBeenCalledWith('product-1', {
        name: 'Updated Name',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles full product update with variants', async () => {
      const product = buildProductResult({
        variants: [{ id: 'variant-1', scent: 'Lavender', size: 'Large', stock: 15 }],
      });
      vi.mocked(adminProductService.updateProduct).mockResolvedValue(product);
      const req = {
        params: { id: 'product-1' },
        body: {
          name: 'Lavender Bliss',
          description: 'A soothing lavender candle',
          price: 24.99,
          variants: [{ id: 'variant-1', scent: 'Lavender', size: 'Large', stock: 15 }],
        },
      } as unknown as Request;

      await updateProduct(req, res, next);

      expect(vi.mocked(adminProductService.updateProduct)).toHaveBeenCalledWith(
        'product-1',
        req.body,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('propagates 404 service error when product not found', async () => {
      const error = new ApiError(404, 'Product not found');
      vi.mocked(adminProductService.updateProduct).mockRejectedValue(error);
      const req = {
        params: { id: 'missing-id' },
        body: { name: 'New Name' },
      } as unknown as Request;

      await asyncHandler(updateProduct)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates 409 service error when removing variant with orders', async () => {
      const error = new ApiError(409, 'Cannot remove a variant with existing orders');
      vi.mocked(adminProductService.updateProduct).mockRejectedValue(error);
      const req = {
        params: { id: 'product-1' },
        body: { variants: [] },
      } as unknown as Request;

      await asyncHandler(updateProduct)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates non-ApiError service errors unchanged', async () => {
      const error = new Error('Unexpected database failure');
      vi.mocked(adminProductService.updateProduct).mockRejectedValue(error);
      const req = {
        params: { id: 'product-1' },
        body: { name: 'New Name' },
      } as unknown as Request;

      await asyncHandler(updateProduct)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProductStatus', () => {
    it('delegates to the service and responds 200 with updated status', async () => {
      const status = buildPublishStatusResult({ id: 'product-1', isPublished: true });
      vi.mocked(adminProductService.setProductPublishStatus).mockResolvedValue(status);
      const req = {
        params: { id: 'product-1' },
        body: { isPublished: true },
      } as unknown as Request;

      await updateProductStatus(req, res, next);

      expect(vi.mocked(adminProductService.setProductPublishStatus)).toHaveBeenCalledWith(
        'product-1',
        true,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          message: 'Product status updated',
          data: status,
        }),
      );
    });

    it('handles unpublishing a product (isPublished: false)', async () => {
      const status = buildPublishStatusResult({ id: 'product-1', isPublished: false });
      vi.mocked(adminProductService.setProductPublishStatus).mockResolvedValue(status);
      const req = {
        params: { id: 'product-1' },
        body: { isPublished: false },
      } as unknown as Request;

      await updateProductStatus(req, res, next);

      expect(vi.mocked(adminProductService.setProductPublishStatus)).toHaveBeenCalledWith(
        'product-1',
        false,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles publishing a product (isPublished: true)', async () => {
      const status = buildPublishStatusResult({ id: 'product-1', isPublished: true });
      vi.mocked(adminProductService.setProductPublishStatus).mockResolvedValue(status);
      const req = {
        params: { id: 'product-1' },
        body: { isPublished: true },
      } as unknown as Request;

      await updateProductStatus(req, res, next);

      expect(vi.mocked(adminProductService.setProductPublishStatus)).toHaveBeenCalledWith(
        'product-1',
        true,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('propagates 404 service error when product not found', async () => {
      const error = new ApiError(404, 'Product not found');
      vi.mocked(adminProductService.setProductPublishStatus).mockRejectedValue(error);
      const req = {
        params: { id: 'missing-id' },
        body: { isPublished: true },
      } as unknown as Request;

      await asyncHandler(updateProductStatus)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('propagates non-ApiError service errors unchanged', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(adminProductService.setProductPublishStatus).mockRejectedValue(error);
      const req = {
        params: { id: 'product-1' },
        body: { isPublished: true },
      } as unknown as Request;

      await asyncHandler(updateProductStatus)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  it('propagates service errors unchanged via next', async () => {
    const error = { statusCode: 404, message: 'Product not found' };
    vi.mocked(adminProductService.updateProduct).mockRejectedValue(error);
    const req = { params: { id: 'missing-id' }, body: {} } as unknown as Request;

    await asyncHandler(updateProduct)(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

import { listProducts, getProductById } from '../../src/controllers/product.controller.js';
import * as productService from '../../src/services/product.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/product.service.js');

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe.skip('product.controller', () => {
  it('listProducts delegates to getPublishedProducts and responds 200 with SuccessResponse', async () => {
    const payload = { items: [], page: 1, limit: 20, total: 0 };
    vi.mocked(productService.getPublishedProducts).mockResolvedValue(payload);
    const req: any = { query: { scent: 'vanilla' } };
    const res = mockRes();
    const next = vi.fn();

    await listProducts(req, res, next);

    expect(productService.getPublishedProducts).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, success: true, message: 'OK', data: payload }),
    );
  });

  it('getProductById delegates to getPublishedProductById and responds 200 with SuccessResponse', async () => {
    const product = { id: 'p1', name: 'Candle', photos: ['a.jpg'], variants: [] };
    vi.mocked(productService.getPublishedProductById).mockResolvedValue(product);
    const req: any = { params: { id: 'p1' } };
    const res = mockRes();
    const next = vi.fn();

    await getProductById(req, res, next);

    expect(productService.getPublishedProductById).toHaveBeenCalledWith('p1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, success: true, message: 'OK', data: product }),
    );
  });

  it('getProductById propagates a 404 to the error-handling middleware without swallowing it', async () => {
    vi.mocked(productService.getPublishedProductById).mockRejectedValue(
      new ApiError(404, 'Product not found'),
    );
    const req: any = { params: { id: 'missing' } };
    const res = mockRes();
    const next = vi.fn();

    await getProductById(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Product not found' }),
    );
  });
});

import { prisma } from '../../src/config/db.js';
import {
  getPublishedProducts,
  getPublishedProductById,
} from '../../src/services/product.service.js';

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('getPublishedProducts', () => {
  it('applies defaults and filters to published products only when no filters are given', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await getPublishedProducts({});

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
  });

  it('filters by scent and size combined with AND, not OR', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await getPublishedProducts({ scent: 'vanilla', size: 'large' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          variants: expect.objectContaining({
            some: expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({ scent: 'vanilla' }),
                expect.objectContaining({ size: 'large' }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it('returns the full variant list of a matching product, not just the matching variant', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue({
      id: 'p1',
      name: 'Candle',
      description: 'A test candle',
      price: 19.99,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      variants: [
        { id: '1', scent: 'vanilla', size: 'large', stock: 5 },
        { id: '2', scent: 'lavender', size: 'small', stock: 3 },
        { id: '3', scent: 'rose', size: 'medium', stock: 1 },
      ],
    });
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    const result = await getPublishedProducts({ scent: 'vanilla' });

    expect(result.items[0].variants).toHaveLength(3);
  });

  it('resolves an empty result set without throwing when nothing matches', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    const result = await getPublishedProducts({ scent: 'nonexistent' });

    expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });

  it('resolves an empty page without error when the page is beyond the last page', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(5);

    const result = await getPublishedProducts({ page: 99 });

    expect(result).toEqual({ items: [], page: 99, limit: 20, total: 5 });
  });

  it('excludes unpublished products by sending isPublished: true to Prisma', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await getPublishedProducts({});

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isPublished: true }) }),
    );
  });
});
describe.skip('getPublishedProductById', () => {
  it('resolves the full detail shape when the product exists and is published', async () => {
    const product = {
      id: 'p1',
      name: 'Candle',
      isPublished: true,
      photos: ['a.jpg'],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: '',
      price: 10.99,
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(product);

    const result = await getPublishedProductById('p1');

    expect(result).toEqual(product);
  });
  it('throws ApiError 404 "Product not found" when the product does not exist', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(getPublishedProductById('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('throws the identical ApiError 404 "Product not found" when the product exists but is not published', async () => {
    const product = {
      id: 'p1',
      name: 'Candle',
      isPublished: false,
      photos: ['a.jpg'],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: '',
      price: 10.99,
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(product);

    await expect(getPublishedProductById('p1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('resolves successfully with an empty variants array when the product has zero variants', async () => {
    const product = {
      id: 'p1',
      name: 'Candle',
      isPublished: true,
      photos: ['a.jpg'],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: '',
      price: 10.99,
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(product);

    const result = await getPublishedProductById('p1');

    expect(result.variants).toEqual([]);
  });
});

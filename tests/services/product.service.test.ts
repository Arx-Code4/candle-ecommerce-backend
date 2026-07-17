import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Product, ProductPhoto, ProductVariant } from '@prisma/client';
import {
  getPublishedProducts,
  getPublishedProductById,
} from '../../src/services/product.service.js';
import { prisma } from '../../src/config/db.js';

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

// Mock builders reflect the ACTUAL schema.prisma shapes (Prisma's raw return
// values), NOT the service's output shapes — the service maps between them.
function buildProduct(overrides: Partial<Product> = {}) {
  return {
    id: 'p1',
    name: 'Candle',
    description: 'A test candle',
    price: new Prisma.Decimal('19.99'),
    isPublished: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildProductVariant(overrides: Partial<ProductVariant> = {}) {
  return {
    id: 'variant-1',
    productId: 'p1',
    scent: 'vanilla',
    size: 'large',
    stock: 5,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildProductPhoto(overrides: Partial<ProductPhoto> = {}) {
  return {
    id: 'photo-1',
    productId: 'p1',
    url: 'a.jpg',
    sortOrder: 0,
    ...overrides,
  };
}

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
    const mockProducts = [
      {
        ...buildProduct({ id: 'p1' }),
        variants: [
          buildProductVariant({ id: '1', scent: 'vanilla', size: 'large', stock: 5 }),
          buildProductVariant({ id: '2', scent: 'lavender', size: 'small', stock: 3 }),
          buildProductVariant({ id: '3', scent: 'rose', size: 'medium', stock: 1 }),
        ],
      },
    ];

    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    // ProductSummary.variants only has {id, scent, size, stock} — the service
    // is expected to project down from the full ProductVariant relation.
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
    const mockProduct = {
      ...buildProduct({ id: 'p1', name: 'Candle', isPublished: true }),
      photos: [buildProductPhoto({ url: 'a.jpg' })],
      variants: [buildProductVariant({ id: 'v1', scent: 'vanilla', size: 'large', stock: 5 })],
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct);

    const result = await getPublishedProductById('p1');

    // ProductDetail's real declared shape: { id, name, variants, photos: string[] }.
    // No description/price/isPublished/createdAt/updatedAt, and photos are
    // plain URL strings, not the raw ProductPhoto relation objects.
    expect(result).toEqual({
      id: 'p1',
      name: 'Candle',
      variants: [{ id: 'v1', scent: 'vanilla', size: 'large', stock: 5 }],
      photos: ['a.jpg'],
    });
  });

  it('throws ApiError 404 "Product not found" when the product does not exist', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(getPublishedProductById('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('throws the identical ApiError 404 "Product not found" when the product exists but is not published', async () => {
    const mockProduct = {
      ...buildProduct({ id: 'p1', isPublished: false }),
      photos: [buildProductPhoto()],
      variants: [],
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct);

    await expect(getPublishedProductById('p1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('resolves successfully with an empty variants array when the product has zero variants', async () => {
    const mockProduct = {
      ...buildProduct({ id: 'p1', isPublished: true }),
      photos: [buildProductPhoto()],
      variants: [],
    };
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct);

    const result = await getPublishedProductById('p1');

    expect(result.variants).toEqual([]);
  });
});

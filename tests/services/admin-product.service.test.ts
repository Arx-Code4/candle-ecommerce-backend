import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import {
  createProduct,
  getAllProducts,
  updateProduct,
  setProductPublishStatus,
  ProductDetail,
  ProductPhotoDetail,
  ProductVariantDetail,
} from '../../src/services/admin-product.service.js';
import { prisma } from '../../src/config/db.js';
import ApiError from '../../src/utils/ApiError.js';

// Alias types for readability (they are the same as the service exports)
type ProductPhoto = ProductPhotoDetail;
type ProductVariant = ProductVariantDetail;

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      count: vi.fn(),
    },
  },
}));

// Helper to build a Prisma-shaped P2025 error (record not found)
function makeP2025Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '5.0.0',
    meta: { target: ['id'] },
  });
}

// ---------- Factory functions for type-safe mock data ----------

// Build a full Prisma Product with relations (because the service uses include)
function buildPrismaProductWithRelations(
  overrides: Partial<Product> & {
    photos?: ProductPhoto[];
    variants?: ProductVariant[];
  } = {},
): Product & { photos: ProductPhoto[]; variants: ProductVariant[] } {
  const defaultPhotos: ProductPhoto[] = [
    { id: 'photo-1', url: 'https://example.com/photo.jpg', sortOrder: 0 },
  ];
  const defaultVariants: ProductVariant[] = [
    { id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 },
  ];
  return {
    id: 'product-1',
    name: 'Vanilla Bliss',
    description: 'A warm vanilla candle',
    price: new Prisma.Decimal('19.99'),
    isPublished: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: overrides.photos ?? defaultPhotos,
    variants: overrides.variants ?? defaultVariants,
    ...overrides,
  };
}

// Build ProductDetail (service return type)
function buildProductDetail(overrides: Partial<ProductDetail> = {}): ProductDetail {
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin-product.service', () => {
  describe('createProduct', () => {
    it('creates product with photos and variants in one write', async () => {
      const productDetail = buildProductDetail();
      const prismaProduct = buildPrismaProductWithRelations();
      vi.mocked(prisma.product.create).mockResolvedValue(prismaProduct);

      const result = await createProduct({
        name: productDetail.name,
        description: productDetail.description,
        price: productDetail.price,
        photos: [{ url: productDetail.photos[0].url }],
        variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
      });

      expect(result).toEqual(productDetail);
      expect(vi.mocked(prisma.product.create)).toHaveBeenCalledTimes(1);
    });

    it('sortOrder omitted defaults to array index', async () => {
      vi.mocked(prisma.product.create).mockResolvedValue(buildPrismaProductWithRelations());

      await createProduct({
        name: 'Vanilla Bliss',
        description: 'A warm vanilla candle',
        price: 19.99,
        photos: [{ url: 'a' }, { url: 'b' }],
        variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
      });

      const callArgs = vi.mocked(prisma.product.create).mock.calls[0][0];
      const photoCreates = callArgs.data.photos?.create as any[];
      expect(photoCreates[0].sortOrder).toBe(0);
      expect(photoCreates[1].sortOrder).toBe(1);
    });

    it('rejects a duplicate scent/size combination before the DB write', async () => {
      await expect(
        createProduct({
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'a' }],
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Duplicate scent/size combination',
      });

      expect(vi.mocked(prisma.product.create)).not.toHaveBeenCalled();
    });

    it('detects duplicates case/whitespace-insensitively', async () => {
      await expect(
        createProduct({
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'a' }],
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: ' vanilla ', size: 'large', stock: 5 },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Duplicate scent/size combination',
      });
    });

    it('preserves original casing/whitespace on write', async () => {
      vi.mocked(prisma.product.create).mockResolvedValue(buildPrismaProductWithRelations());

      await createProduct({
        name: 'Vanilla Bliss',
        description: 'A warm vanilla candle',
        price: 19.99,
        photos: [{ url: 'a' }],
        variants: [{ scent: ' Vanilla ', size: 'Large', stock: 10 }],
      });

      const callArgs = vi.mocked(prisma.product.create).mock.calls[0][0];
      const variantCreates = callArgs.data.variants?.create as any[];
      expect(variantCreates[0].scent).toBe(' Vanilla ');
    });

    it('throws ApiError(409) when duplicate scent/size is detected', async () => {
      await expect(
        createProduct({
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'a' }],
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('getAllProducts', () => {
    it('returns both published and unpublished products', async () => {
      const mockPrismaProducts = [
        buildPrismaProductWithRelations({ isPublished: true }),
        buildPrismaProductWithRelations({ id: 'product-2', isPublished: false }),
      ];
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockPrismaProducts);
      vi.mocked(prisma.product.count).mockResolvedValue(2);

      await getAllProducts({});

      const callArgs = vi.mocked(prisma.product.findMany).mock.calls[0][0];
      expect(callArgs?.where?.isPublished).toBeUndefined();
    });

    it('returns an empty page when requesting a page beyond the last page', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(5);

      const result = await getAllProducts({ page: 99 });

      expect(result).toEqual({ items: [], total: 5, page: 99, limit: 20 });
    });

    it('applies default pagination when page and limit are omitted', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(0);

      await getAllProducts({});

      const callArgs = vi.mocked(prisma.product.findMany).mock.calls[0][0];
      expect(callArgs?.skip).toBe(0);
      expect(callArgs?.take).toBe(20);
    });

    it('applies custom pagination when page and limit are provided', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(0);

      await getAllProducts({ page: 3, limit: 10 });

      const callArgs = vi.mocked(prisma.product.findMany).mock.calls[0][0];
      expect(callArgs?.skip).toBe(20); // (3-1) * 10
      expect(callArgs?.take).toBe(10);
    });
  });

  describe('updateProduct', () => {
    it('updates only the name when only name is provided', async () => {
      const prismaProduct = buildPrismaProductWithRelations();
      const updatedPrismaProduct = buildPrismaProductWithRelations({ name: 'New Name' });
      vi.mocked(prisma.product.findUnique).mockResolvedValue(prismaProduct);
      vi.mocked(prisma.product.update).mockResolvedValue(updatedPrismaProduct);

      await updateProduct('product-1', { name: 'New Name' });

      const callArgs = vi.mocked(prisma.product.update).mock.calls[0][0];
      expect(callArgs.data).toEqual({ name: 'New Name' });
    });

    it('fully replaces photos when a photos array is sent', async () => {
      const prismaProduct = buildPrismaProductWithRelations();
      vi.mocked(prisma.product.findUnique).mockResolvedValue(prismaProduct);
      vi.mocked(prisma.product.update).mockResolvedValue(buildPrismaProductWithRelations());

      await updateProduct('product-1', { photos: [{ url: 'd' }, { url: 'e' }] });

      const callArgs = vi.mocked(prisma.product.update).mock.calls[0][0];
      expect(callArgs.data.photos?.deleteMany).toBeDefined();
    });

    it('throws 404 when the product is not found', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      await expect(updateProduct('missing-id', { name: 'New Name' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });

    it('rejects a duplicate scent/size combination in submitted variants', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(buildPrismaProductWithRelations());

      await expect(
        updateProduct('product-1', {
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Duplicate scent/size combination',
      });

      expect(vi.mocked(prisma.product.update)).not.toHaveBeenCalled();
    });

    it('rejects removing a variant that has existing order items', async () => {
      // Provide a product with at least one variant
      const existingProduct = buildPrismaProductWithRelations({
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
      });
      vi.mocked(prisma.product.findUnique).mockResolvedValue(existingProduct);

      // Mock orderItem.count to return >0
      vi.mocked(prisma.orderItem.count).mockResolvedValue(1);

      await expect(updateProduct('product-1', { variants: [] })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot remove a variant with existing orders',
      });
    });

    it('allows removing a variant with no existing orders', async () => {
      const existingProduct = buildPrismaProductWithRelations({
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
      });
      vi.mocked(prisma.product.findUnique).mockResolvedValue(existingProduct);
      vi.mocked(prisma.orderItem.count).mockResolvedValue(0);

      const updatedPrismaProduct = buildPrismaProductWithRelations({
        variants: [],
      });
      vi.mocked(prisma.product.update).mockResolvedValue(updatedPrismaProduct);

      const result = await updateProduct('product-1', { variants: [] });

      expect(result.variants).toEqual([]);
    });

    it('updates variants with matching ids in place instead of recreating them', async () => {
      const existingProduct = buildPrismaProductWithRelations({
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
      });
      vi.mocked(prisma.product.findUnique).mockResolvedValue(existingProduct);

      const updatedPrismaProduct = buildPrismaProductWithRelations({
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 99 }],
      });
      vi.mocked(prisma.product.update).mockResolvedValue(updatedPrismaProduct);

      await updateProduct('product-1', {
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 99 }],
      });

      const callArgs = vi.mocked(prisma.product.update).mock.calls[0][0];
      const variantUpdates = callArgs.data.variants?.update as any[];
      expect(variantUpdates[0].where.id).toBe('variant-1');
    });

    it('throws ApiError(409) when duplicate variant is detected', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(buildPrismaProductWithRelations());

      await expect(
        updateProduct('product-1', {
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('setProductPublishStatus', () => {
    it('publishes an unpublished product', async () => {
      const prismaProduct = buildPrismaProductWithRelations({ isPublished: true });
      vi.mocked(prisma.product.update).mockResolvedValue(prismaProduct);

      const result = await setProductPublishStatus('product-1', true);

      expect(result).toEqual({ id: 'product-1', isPublished: true });
    });

    it('unpublishes (soft-deletes) a product', async () => {
      const prismaProduct = buildPrismaProductWithRelations({ isPublished: false });
      vi.mocked(prisma.product.update).mockResolvedValue(prismaProduct);

      const result = await setProductPublishStatus('product-1', false);

      expect(result).toEqual({ id: 'product-1', isPublished: false });
    });

    it('throws 404 when the product is not found', async () => {
      vi.mocked(prisma.product.update).mockRejectedValue(makeP2025Error());

      await expect(setProductPublishStatus('missing-id', true)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });

    it('is idempotent when setting the same value again', async () => {
      const prismaProduct = buildPrismaProductWithRelations({ isPublished: true });
      vi.mocked(prisma.product.update).mockResolvedValue(prismaProduct);

      await expect(setProductPublishStatus('product-1', true)).resolves.toEqual({
        id: 'product-1',
        isPublished: true,
      });
    });

    it('throws ApiError(404) when product not found', async () => {
      vi.mocked(prisma.product.update).mockRejectedValue(makeP2025Error());

      await expect(setProductPublishStatus('missing-id', true)).rejects.toBeInstanceOf(ApiError);
      await expect(setProductPublishStatus('missing-id', true)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });
  });
});

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/db.js';
import {
  createProduct,
  getAllProducts,
  updateProduct,
  setProductPublishStatus,
  ProductDetail,
} from '../../src/services/admin-product.service.js';

const mockedPrisma = prisma as unknown as {
  product: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const buildProduct = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'product-1',
  name: 'Vanilla Bliss',
  description: 'A warm vanilla candle',
  price: 19.99,
  isPublished: false,
  photos: [{ id: 'photo-1', url: 'https://example.com/photo.jpg', sortOrder: 0 }],
  variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 10 }],
  ...overrides,
});

describe.skip('admin-product.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProduct', () => {
    it('creates product with photos and variants in one write', async () => {
      const product = buildProduct();
      mockedPrisma.product.create.mockResolvedValue(product);

      const result = await createProduct({
        name: product.name,
        description: product.description,
        price: product.price,
        photos: [{ url: product.photos[0].url }],
        variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
      });

      expect(result).toEqual(product);
      expect(mockedPrisma.product.create).toHaveBeenCalledTimes(1);
    });

    it('sortOrder omitted defaults to array index', async () => {
      mockedPrisma.product.create.mockResolvedValue(buildProduct());

      await createProduct({
        name: 'Vanilla Bliss',
        description: 'A warm vanilla candle',
        price: 19.99,
        photos: [{ url: 'a' }, { url: 'b' }],
        variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
      });

      const callArgs = mockedPrisma.product.create.mock.calls[0][0];
      const photoCreates = callArgs.data.photos.create;
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
      ).rejects.toMatchObject({ statusCode: 400, message: 'Duplicate scent/size combination' });

      expect(mockedPrisma.product.create).not.toHaveBeenCalled();
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
      ).rejects.toMatchObject({ statusCode: 400, message: 'Duplicate scent/size combination' });
    });

    it('preserves original casing/whitespace on write', async () => {
      mockedPrisma.product.create.mockResolvedValue(buildProduct());

      await createProduct({
        name: 'Vanilla Bliss',
        description: 'A warm vanilla candle',
        price: 19.99,
        photos: [{ url: 'a' }],
        variants: [{ scent: ' Vanilla ', size: 'Large', stock: 10 }],
      });

      const callArgs = mockedPrisma.product.create.mock.calls[0][0];
      expect(callArgs.data.variants.create[0].scent).toBe(' Vanilla ');
    });
  });

  describe('getAllProducts', () => {
    it('returns both published and unpublished products', async () => {
      mockedPrisma.product.findMany.mockResolvedValue([
        buildProduct({ isPublished: true }),
        buildProduct({ id: 'product-2', isPublished: false }),
      ]);
      mockedPrisma.product.count.mockResolvedValue(2);

      await getAllProducts({});

      const callArgs = mockedPrisma.product.findMany.mock.calls[0][0];
      expect(callArgs?.where?.isPublished).toBeUndefined();
    });

    it('returns an empty page when requesting a page beyond the last page', async () => {
      mockedPrisma.product.findMany.mockResolvedValue([]);
      mockedPrisma.product.count.mockResolvedValue(5);

      const result = await getAllProducts({ page: 99 });

      expect(result).toEqual({ items: [], total: 5, page: 99, limit: 20 });
    });
  });

  describe('updateProduct', () => {
    it('updates only the name when only name is provided', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(buildProduct());
      mockedPrisma.product.update.mockResolvedValue(buildProduct({ name: 'New Name' }));

      await updateProduct('product-1', { name: 'New Name' });

      const callArgs = mockedPrisma.product.update.mock.calls[0][0];
      expect(callArgs.data).toEqual({ name: 'New Name' });
    });

    it('fully replaces photos when a photos array is sent', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(
        buildProduct({
          photos: [
            { id: 'photo-1', url: 'a', sortOrder: 0 },
            { id: 'photo-2', url: 'b', sortOrder: 1 },
            { id: 'photo-3', url: 'c', sortOrder: 2 },
          ],
        }),
      );
      mockedPrisma.product.update.mockResolvedValue(buildProduct());

      await updateProduct('product-1', { photos: [{ url: 'd' }, { url: 'e' }] });

      const callArgs = mockedPrisma.product.update.mock.calls[0][0];
      expect(callArgs.data.photos.deleteMany).toBeDefined();
    });

    it('throws 404 when the product is not found', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(null);

      await expect(updateProduct('missing-id', { name: 'New Name' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });

    it('rejects a duplicate scent/size combination in submitted variants', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(buildProduct());

      await expect(
        updateProduct('product-1', {
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Duplicate scent/size combination' });

      expect(mockedPrisma.product.update).not.toHaveBeenCalled();
    });

    it('rejects removing a variant that has existing order items', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(
        buildProduct({
          variants: [{ id: 'variant-with-orders', scent: 'Vanilla', size: 'Large', stock: 10 }],
        }),
      );

      await expect(updateProduct('product-1', { variants: [] })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot remove a variant with existing orders',
      });

      expect(mockedPrisma.product.update).not.toHaveBeenCalled();
    });

    it('allows removing a variant with no existing orders', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(
        buildProduct({
          variants: [{ id: 'variant-no-orders', scent: 'Vanilla', size: 'Large', stock: 10 }],
        }),
      );
      mockedPrisma.product.update.mockResolvedValue(buildProduct({ variants: [] }));

      const result = await updateProduct('product-1', { variants: [] });

      expect(result.variants).toEqual([]);
    });

    it('updates variants with matching ids in place instead of recreating them', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(buildProduct());
      mockedPrisma.product.update.mockResolvedValue(buildProduct());

      await updateProduct('product-1', {
        variants: [{ id: 'variant-1', scent: 'Vanilla', size: 'Large', stock: 99 }],
      });

      const callArgs = mockedPrisma.product.update.mock.calls[0][0];
      expect(callArgs.data.variants.update[0].where.id).toBe('variant-1');
    });
  });

  describe('setProductPublishStatus', () => {
    it('publishes an unpublished product', async () => {
      mockedPrisma.product.update.mockResolvedValue({ id: 'product-1', isPublished: true });

      const result = await setProductPublishStatus('product-1', true);

      expect(result).toEqual({ id: 'product-1', isPublished: true });
    });

    it('unpublishes (soft-deletes) a product', async () => {
      mockedPrisma.product.update.mockResolvedValue({ id: 'product-1', isPublished: false });

      const result = await setProductPublishStatus('product-1', false);

      expect(result).toEqual({ id: 'product-1', isPublished: false });
    });

    it('throws 404 when the product is not found', async () => {
      mockedPrisma.product.update.mockRejectedValue({ code: 'P2025' });

      await expect(setProductPublishStatus('missing-id', true)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product not found',
      });
    });

    it('is idempotent when setting the same value again', async () => {
      mockedPrisma.product.update.mockResolvedValue({ id: 'product-1', isPublished: true });

      await expect(setProductPublishStatus('product-1', true)).resolves.toEqual({
        id: 'product-1',
        isPublished: true,
      });
    });
  });
});

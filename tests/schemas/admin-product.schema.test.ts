import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from '../../src/schemas/admin-product.schema.js';

describe.skip('admin-product.schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProductSchema', () => {
    it('accepts a valid full payload', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg', sortOrder: 0 }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).not.toThrow();
    });

    it('rejects missing photos', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects missing variants', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('coerces price to number', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: '19.99',
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      const result = createProductSchema.parse(input);

      expect(result.body.price).toBe(19.99);
    });

    it('rejects non-positive price', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: '0',
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects invalid photo URL', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'not-a-url' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects negative variant stock', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: -1 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });
  });

  describe('updateProductSchema', () => {
    it('allows all fields omitted', () => {
      const input = { body: {} };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('allows variant id when present', () => {
      const input = {
        body: {
          variants: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              scent: 'Vanilla',
              size: 'Large',
              stock: 5,
            },
          ],
        },
      };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('rejects a non-uuid variant id', () => {
      const input = {
        body: {
          variants: [{ id: 'bad-id', scent: 'Vanilla', size: 'Large', stock: 5 }],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });
  });

  describe('updateProductStatusSchema', () => {
    it('requires boolean isPublished', () => {
      const input = { body: { isPublished: 'true' } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });

    it('accepts boolean true/false', () => {
      expect(() => updateProductStatusSchema.parse({ body: { isPublished: false } })).not.toThrow();
      expect(() => updateProductStatusSchema.parse({ body: { isPublished: true } })).not.toThrow();
    });
  });
});

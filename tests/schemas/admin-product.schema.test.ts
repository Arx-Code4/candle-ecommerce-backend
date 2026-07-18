// tests/schemas/admin-product.schema.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from '../../src/schemas/admin-product.schema.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('admin-product.schema', () => {
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

    // FIXED: Test name now accurately reflects what it tests
    it('rejects empty photos array (at least one photo required)', () => {
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

    // FIXED: Test name now accurately reflects what it tests
    it('rejects empty variants array (at least one variant required)', () => {
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

    it('rejects non-positive price (zero)', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 0,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects non-positive price (negative)', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: -10.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects invalid photo URL format', () => {
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

    it('accepts photo URL with https', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).not.toThrow();
    });

    it('accepts photo URL with http', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'http://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).not.toThrow();
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

    it('rejects variant stock as decimal', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10.5 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects empty name', () => {
      const input = {
        body: {
          name: '',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('rejects empty description', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: '',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).toThrow();
    });

    it('accepts sortOrder when provided', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg', sortOrder: 5 }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).not.toThrow();
    });

    it('allows sortOrder to be omitted (defaults to array index)', () => {
      const input = {
        body: {
          name: 'Vanilla Bliss',
          description: 'A warm vanilla candle',
          price: 19.99,
          photos: [{ url: 'https://example.com/photo.jpg' }],
          variants: [{ scent: 'Vanilla', size: 'Large', stock: 10 }],
        },
      };

      expect(() => createProductSchema.parse(input)).not.toThrow();
    });
  });

  describe('updateProductSchema', () => {
    it('allows all fields omitted (partial update)', () => {
      const input = { body: {} };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('allows updating only the name', () => {
      const input = { body: { name: 'New Name' } };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('allows updating only the description', () => {
      const input = { body: { description: 'New description' } };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('allows updating only the price', () => {
      const input = { body: { price: 29.99 } };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('allows variant id when present (valid UUID)', () => {
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

    it('allows variant without id (new variant)', () => {
      const input = {
        body: {
          variants: [{ scent: 'Lavender', size: 'Small', stock: 8 }],
        },
      };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });

    it('rejects duplicate scent/size in variants array', () => {
      const input = {
        body: {
          variants: [
            { scent: 'Vanilla', size: 'Large', stock: 10 },
            { scent: 'Vanilla', size: 'Large', stock: 5 },
          ],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });

    it('rejects negative stock in variant update', () => {
      const input = {
        body: {
          variants: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              scent: 'Vanilla',
              size: 'Large',
              stock: -5,
            },
          ],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });

    it('rejects empty scent in variant', () => {
      const input = {
        body: {
          variants: [{ scent: '', size: 'Large', stock: 10 }],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });

    it('rejects empty size in variant', () => {
      const input = {
        body: {
          variants: [{ scent: 'Vanilla', size: '', stock: 10 }],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });

    it('rejects photo with invalid URL in update', () => {
      const input = {
        body: {
          photos: [{ url: 'not-a-url' }],
        },
      };

      expect(() => updateProductSchema.parse(input)).toThrow();
    });

    it('accepts photos with valid URLs in update', () => {
      const input = {
        body: {
          photos: [{ url: 'https://example.com/new-photo.jpg' }],
        },
      };

      expect(() => updateProductSchema.parse(input)).not.toThrow();
    });
  });

  describe('updateProductStatusSchema', () => {
    it('requires isPublished to be a boolean (string "true" rejected)', () => {
      const input = { body: { isPublished: 'true' } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });

    it('accepts boolean true', () => {
      expect(() => updateProductStatusSchema.parse({ body: { isPublished: true } })).not.toThrow();
    });

    it('accepts boolean false', () => {
      expect(() => updateProductStatusSchema.parse({ body: { isPublished: false } })).not.toThrow();
    });

    it('rejects isPublished as number 1', () => {
      const input = { body: { isPublished: 1 } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });

    it('rejects isPublished as number 0', () => {
      const input = { body: { isPublished: 0 } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });

    it('rejects isPublished as null', () => {
      const input = { body: { isPublished: null } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });

    it('rejects isPublished as undefined', () => {
      const input = { body: { isPublished: undefined } };

      expect(() => updateProductStatusSchema.parse(input)).toThrow();
    });
  });
});

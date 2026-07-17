import { addCartItemSchema, updateCartItemSchema } from '../../src/schemas/cart.schema.js';

const validUuid = '123e4567-e89b-12d3-a456-426614174000';

describe.skip('cart.schema', () => {
  describe('addCartItemSchema', () => {
    it('requires productVariantId as uuid', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: 'not-a-uuid' },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests no productVariantId at all
    it('rejects missing productVariantId', () => {
      const result = addCartItemSchema.safeParse({
        body: {},
      });

      expect(result.success).toBe(false);
    });

    it('defaults quantity to 1', () => {
      const result = addCartItemSchema.parse({
        body: { productVariantId: validUuid },
      });

      expect(result.body.quantity).toBe(1);
    });

    it('coerces string quantity', () => {
      const result = addCartItemSchema.parse({
        body: { productVariantId: validUuid, quantity: '3' },
      });

      expect(result.body.quantity).toBe(3);
    });

    // case not included in documentation - tests the minimum boundary
    it('accepts quantity at the minimum boundary', () => {
      const result = addCartItemSchema.parse({
        body: { productVariantId: validUuid, quantity: '1' },
      });

      expect(result.body.quantity).toBe(1);
    });

    it('rejects quantity below 1', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: validUuid, quantity: '0' },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests decimal input
    it('rejects non-integer quantity', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: validUuid, quantity: '3.5' },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests string input
    it('rejects non-numeric quantity string', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: validUuid, quantity: 'abc' },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateCartItemSchema', () => {
    it('requires quantity with no default', () => {
      const result = updateCartItemSchema.safeParse({
        body: {},
        params: { itemId: validUuid },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests for coercing string quantity
    it('coerces string quantity', () => {
      const result = updateCartItemSchema.parse({
        body: { quantity: '2' },
        params: { itemId: validUuid },
      });

      expect(result.body.quantity).toBe(2);
    });

    // case not included in documentation - tests for quantity below 1
    it('rejects quantity below 1', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '0' },
        params: { itemId: validUuid },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests for decimal inputs
    it('rejects non-integer quantity', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '2.5' },
        params: { itemId: validUuid },
      });

      expect(result.success).toBe(false);
    });

    it('validates itemId as uuid param', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '2' },
        params: { itemId: 'bad-id' },
      });

      expect(result.success).toBe(false);
    });

    // case not included in documentation - tests for missing Id
    it('rejects missing itemId', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '2' },
        params: {},
      });

      expect(result.success).toBe(false);
    });
  });
});

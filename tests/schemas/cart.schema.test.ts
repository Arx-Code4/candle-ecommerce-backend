import { addCartItemSchema, updateCartItemSchema } from '../../src/schemas/cart.schema.js';

const validUuid = '123e4567-e89b-12d3-a456-426614174000';

describe('cart.schema', () => {
  describe('addCartItemSchema', () => {
    it('requires productVariantId as uuid', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: 'not-a-uuid' },
      });

      expect(result.success).toBe(false);
    });

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

    it('rejects non-integer quantity', () => {
      const result = addCartItemSchema.safeParse({
        body: { productVariantId: validUuid, quantity: '3.5' },
      });

      expect(result.success).toBe(false);
    });

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

    it('coerces string quantity', () => {
      const result = updateCartItemSchema.parse({
        body: { quantity: '2' },
        params: { itemId: validUuid },
      });

      expect(result.body.quantity).toBe(2);
    });

    it('rejects quantity below 1', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '0' },
        params: { itemId: validUuid },
      });

      expect(result.success).toBe(false);
    });

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

    it('rejects missing itemId', () => {
      const result = updateCartItemSchema.safeParse({
        body: { quantity: '2' },
        params: {},
      });

      expect(result.success).toBe(false);
    });
  });
});

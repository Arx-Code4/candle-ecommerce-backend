import { listProductsQuerySchema } from '../../src/schemas/product.schema.js';

describe.skip('listProductsQuerySchema', () => {
  it('coerces string page and limit to numbers', () => {
    const result = listProductsQuerySchema.safeParse({ query: { page: '2', limit: '10' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(10);
    }
  });

  it('defaults page and limit when omitted', () => {
    const result = listProductsQuerySchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it('rejects limit above 100', () => {
    const result = listProductsQuerySchema.safeParse({ query: { limit: '101' } });
    expect(result.success).toBe(false);
  });

  // case not listed on test documentation - tests if exactly 100 is handled
  it('accepts limit exactly at the boundary of 100', () => {
    const result = listProductsQuerySchema.safeParse({ query: { limit: '100' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.limit).toBe(100);
    }
  });

  it('rejects non-positive page', () => {
    const result = listProductsQuerySchema.safeParse({ query: { page: '0' } });
    expect(result.success).toBe(false);
  });

  // case not listed in documentation - tests negative inputs
  it('rejects negative limit', () => {
    const result = listProductsQuerySchema.safeParse({ query: { limit: '-5' } });
    expect(result.success).toBe(false);
  });

  // case not listed in documentation - tests decimal inputs for page
  it('rejects non-integer page values', () => {
    const result = listProductsQuerySchema.safeParse({ query: { page: '2.5' } });
    expect(result.success).toBe(false);
  });

  // case not listed in documentation - tests decimal inputs for limit
  it('rejects non-integer limit values', () => {
    const result = listProductsQuerySchema.safeParse({ query: { limit: '10.5' } });
    expect(result.success).toBe(false);
  });

  // case not listed in documentation - tests string inputs
  it('rejects non-numeric page strings', () => {
    const result = listProductsQuerySchema.safeParse({ query: { page: 'abc' } });
    expect(result.success).toBe(false);
  });

  it('passes scent through untouched and leaves size undefined', () => {
    const result = listProductsQuerySchema.safeParse({ query: { scent: 'lavender' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.scent).toBe('lavender');
      expect(result.data.query.size).toBeUndefined();
    }
  });

  it('passes size through untouched and leaves scent undefined', () => {
    const result = listProductsQuerySchema.safeParse({ query: { size: 'medium' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.size).toBe('medium');
      expect(result.data.query.scent).toBeUndefined();
    }
  });

  // case not listed in documentation - tests for both inputs with no interference
  it('accepts scent and size together without interference', () => {
    const result = listProductsQuerySchema.safeParse({
      query: { scent: 'vanilla', size: 'large' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.scent).toBe('vanilla');
      expect(result.data.query.size).toBe('large');
    }
  });
});

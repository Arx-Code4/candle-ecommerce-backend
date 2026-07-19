// tests/schemas/checkout.schema.test.ts
import { describe, it, expect } from 'vitest';
import { initiateCheckoutSchema } from '../../src/schemas/checkout.schema.js';

describe('initiateCheckoutSchema', () => {
  it('requires all three shipping fields', () => {
    const result = initiateCheckoutSchema.safeParse({
      body: { shippingName: 'Abebe' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty string fields', () => {
    const result = initiateCheckoutSchema.safeParse({
      body: { shippingName: '', shippingPhone: 'x', shippingAddress: 'x' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a valid full payload', () => {
    const result = initiateCheckoutSchema.safeParse({
      body: {
        shippingName: 'Abebe',
        shippingPhone: '+251911223344',
        shippingAddress: 'Addis Ababa',
      },
    });

    expect(result.success).toBe(true);
  });
});

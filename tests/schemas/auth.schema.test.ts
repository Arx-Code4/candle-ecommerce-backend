import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../src/schemas/auth.schema.js';

describe('registerSchema', () => {
  const validBase = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  it('accepts a valid payload with no pendingVariantId', () => {
    const result = registerSchema.safeParse({ body: validBase });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      body: { ...validBase, password: 'short' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      body: { ...validBase, email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
  });

  it('allows pendingVariantId to be omitted', () => {
    const result = registerSchema.safeParse({ body: validBase });
    expect(result.success).toBe(true);
  });

  it('rejects pendingVariantId that is not a valid uuid', () => {
    const result = registerSchema.safeParse({
      body: { ...validBase, pendingVariantId: 'not-a-uuid' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts pendingVariantId when it is a valid uuid', () => {
    const result = registerSchema.safeParse({
      body: {
        ...validBase,
        pendingVariantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepts a valid payload', () => {
    const result = loginSchema.safeParse({
      body: { email: 'jane@example.com', password: 'password123' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({
      body: { email: 'jane@example.com', password: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({
      body: { email: 'jane@example.com' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = forgotPasswordSchema.safeParse({
      body: { email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a valid payload with both fields', () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: 'abc123', newPassword: 'newpassword123' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing token', () => {
    const result = resetPasswordSchema.safeParse({
      body: { newPassword: 'newpassword123' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing newPassword', () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: 'abc123' },
    });
    expect(result.success).toBe(false);
  });
});

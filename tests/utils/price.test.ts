import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { toPriceString } from '../../src/utils/price.js';

describe('toPriceString', () => {
  it('converts a Prisma Decimal to a 2-decimal string', () => {
    const decimal = new Prisma.Decimal('19.99');
    expect(toPriceString(decimal)).toBe('19.99');
  });

  it('converts a Prisma Decimal with trailing zeros to a 2-decimal string', () => {
    const decimal = new Prisma.Decimal('19.90');
    expect(toPriceString(decimal)).toBe('19.90');
  });

  it('converts a number to a 2-decimal string', () => {
    expect(toPriceString(19.9)).toBe('19.90');
    expect(toPriceString(19)).toBe('19.00');
    expect(toPriceString(19.999)).toBe('20.00');
  });

  it('converts a numeric string to a 2-decimal string', () => {
    expect(toPriceString('19.9')).toBe('19.90');
    expect(toPriceString('19')).toBe('19.00');
    expect(toPriceString('19.999')).toBe('20.00');
  });

  it('handles zero correctly', () => {
    expect(toPriceString(0)).toBe('0.00');
    expect(toPriceString('0')).toBe('0.00');
    expect(toPriceString(new Prisma.Decimal('0'))).toBe('0.00');
  });

  it('handles negative values correctly', () => {
    expect(toPriceString(-19.99)).toBe('-19.99');
    expect(toPriceString('-19.99')).toBe('-19.99');
    expect(toPriceString(new Prisma.Decimal('-19.99'))).toBe('-19.99');
  });
});

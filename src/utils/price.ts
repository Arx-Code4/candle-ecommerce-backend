import { Prisma } from '@prisma/client';

/**
 * Converts a Prisma Decimal, number, or numeric string to a fixed 2-decimal string.
 *
 * @param value - The value to format (Decimal, number, or string)
 * @returns The formatted price string with exactly 2 decimal places
 *
 * @example
 * toPriceString(new Prisma.Decimal('19.99')) // "19.99"
 * toPriceString(19.9) // "19.90"
 * toPriceString('19.999') // "20.00"
 */
export function toPriceString(value: Prisma.Decimal | number | string): string {
  let num: number;

  if (value && typeof value === 'object' && 'toNumber' in value) {
    num = (value as Prisma.Decimal).toNumber();
  } else {
    num = Number(value);
  }

  return num.toFixed(2);
}

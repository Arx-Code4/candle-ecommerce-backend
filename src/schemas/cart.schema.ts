import { z } from 'zod';

const uuidError = { message: 'Invalid ID format' };

export const addCartItemSchema = z.object({
  body: z.object({
    productVariantId: z.string().uuid(uuidError),
    quantity: z.coerce.number().int().min(1).optional().default(1),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z.coerce.number().int().min(1),
  }),
  params: z.object({
    itemId: z.string().uuid(uuidError),
  }),
});

export const deleteCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(uuidError),
  }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type DeleteCartItemInput = z.infer<typeof deleteCartItemSchema>;

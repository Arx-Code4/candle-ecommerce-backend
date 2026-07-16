import { z } from 'zod';

export const addCartItemSchema = z.object({
  body: z.object({
    productVariantId: z.string(),
    quantity: z.coerce.number().optional().default(1),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z.coerce.number(),
  }),
  params: z.object({
    itemId: z.string(),
  }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

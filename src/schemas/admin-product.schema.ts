import { z } from 'zod';

const productPhotoInputSchema = z.object({
  url: z.string(),
  sortOrder: z.number().optional(),
});

const productVariantInputSchema = z.object({
  id: z.string().optional(),
  scent: z.string(),
  size: z.string(),
  stock: z.coerce.number(),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string(),
    description: z.string(),
    price: z.coerce.number(),
    photos: z.array(productPhotoInputSchema),
    variants: z.array(productVariantInputSchema),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.coerce.number().optional(),
    photos: z.array(productPhotoInputSchema).optional(),
    variants: z.array(productVariantInputSchema).optional(),
  }),
});

export const updateProductStatusSchema = z.object({
  body: z.object({
    isPublished: z.boolean(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;

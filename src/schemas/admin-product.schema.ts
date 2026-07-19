import { z } from 'zod';

// Helper to check for duplicate (scent, size) pairs
const noDuplicateVariants = (variants: { scent: string; size: string }[]) => {
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.scent}|${v.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
};

// Common photo schema
const photoSchema = z.object({
  url: z.string().url(),
  sortOrder: z.number().int().optional(),
});

// Common variant schema (without id)
const variantSchema = z.object({
  scent: z.string().min(1),
  size: z.string().min(1),
  stock: z.number().int().min(0),
});

// Variant schema for updates – id is optional and validated with a lenient regex
const updateVariantSchema = variantSchema.extend({
  id: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .optional(),
});

// CREATE – variants must have at least one and no duplicates
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number().positive(),
    photos: z.array(photoSchema).min(1),
    variants: z.array(variantSchema).min(1).refine(noDuplicateVariants, {
      message: 'Duplicate variant (scent and size combination) not allowed',
    }),
  }),
});

// UPDATE – all fields optional; variants (if provided) are validated for duplicates
export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    photos: z.array(photoSchema).optional(),
    variants: z
      .array(updateVariantSchema)
      .optional()
      .refine(
        (variants) => {
          // If no variants provided or empty array, it's valid (no duplicates)
          if (!variants || variants.length === 0) return true;
          return noDuplicateVariants(variants);
        },
        {
          message: 'Duplicate variant (scent and size combination) not allowed',
        },
      ),
  }),
});

// STATUS update – unchanged
export const updateProductStatusSchema = z.object({
  body: z.object({
    isPublished: z.boolean(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;

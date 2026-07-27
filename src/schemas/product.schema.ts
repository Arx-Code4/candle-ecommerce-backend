import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  query: z.object({
    scent: z.string().optional(),
    size: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;

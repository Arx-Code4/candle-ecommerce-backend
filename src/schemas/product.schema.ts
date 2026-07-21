import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  query: z.object({
    scent: z.string().optional(),
    size: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  }),
});


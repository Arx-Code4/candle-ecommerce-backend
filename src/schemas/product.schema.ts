import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  query: z.object({
    scent: z.string().optional(),
    size: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
});

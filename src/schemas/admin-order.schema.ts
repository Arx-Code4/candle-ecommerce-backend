import { z } from 'zod';

export const listAdminOrdersQuerySchema = z.object({
  query: z.object({
    status: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.string(),
  }),
});

export type ListAdminOrdersQueryInput = z.infer<typeof listAdminOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

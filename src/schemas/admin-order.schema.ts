import { z } from 'zod';

export const listAdminOrdersQuerySchema = z.object({
  query: z.object({
    status: z.enum(['PROCESSING', 'SHIPPED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

// Only 'SHIPPED' is ever a legal target — PROCESSING is the default state,
// never something an admin transitions *to*. Restricting the schema itself
// is a stronger guarantee than relying on the service's transition check alone.
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['SHIPPED']),
  }),
});

export type ListAdminOrdersQueryInput = z.infer<typeof listAdminOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

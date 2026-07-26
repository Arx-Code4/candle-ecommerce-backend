// src/schemas/order.schema.ts
import { z } from 'zod';

// Validates the `:id` route param on GET /orders/:id as a UUID before the
// request reaches getMyOrderById. validate.middleware.ts calls
// schema.parseAsync({ body, params, query }), so the schema's shape must
// mirror that — only `params` is relevant here since this route has no
// body or query fields to validate.
export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid ID format' }),
  }),
});

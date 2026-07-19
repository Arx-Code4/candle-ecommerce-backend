import { z } from 'zod';

export const initiateCheckoutSchema = z.object({
  body: z.object({
    shippingName: z.string().min(1),
    shippingPhone: z.string().min(1),
    shippingAddress: z.string().min(1),
  }),
});

export type InitiateCheckoutInput = z.infer<typeof initiateCheckoutSchema>;

// No schema for the webhook route — Chapa's payload is a raw buffer by the
// time it reaches the controller (see app.ts's raw-body exception), so
// validate.middleware.ts can't run against it. Verification happens inside
// checkout.controller.ts / utils/chapa.ts instead.

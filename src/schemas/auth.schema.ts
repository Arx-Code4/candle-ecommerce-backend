import { z } from 'zod';

// Placeholder — not yet implemented. Deliberately permissive/empty shape
// so the import resolves; real validation shapes land per eco-8.1.2.
export const registerSchema = z.object({ body: z.object({}) });
export const loginSchema = z.object({ body: z.object({}) });
export const forgotPasswordSchema = z.object({ body: z.object({}) });
export const resetPasswordSchema = z.object({ body: z.object({}) });

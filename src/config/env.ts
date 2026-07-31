import { z } from 'zod';
import dotenv from 'dotenv';
import ms from 'ms';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ALLOW_TEST_AUTH_BYPASS: z.string().optional(),
  BCRYPT_SALT_ROUNDS: z.string().default('10'),
  CHAPA_SECRET_KEY: z.string(),
  CHAPA_WEBHOOK_SECRET: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string(),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  FRONTEND_ORDER_CONFIRMATION_URL: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

//auth.service.ts needs this (to set the DB row's expiresAt) and cookies.ts needs it (to set the cookie's maxAge) — computing it once here, instead of in either of those two files, is what makes cookies.ts's import valid, and guarantees the cookie's lifetime and the token's real lifetime can never drift apart.
export const REFRESH_TOKEN_TTL_MS: number = (() => {
  const parsed = ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue);
  if (parsed === undefined) {
    throw new Error('JWT_REFRESH_EXPIRES_IN is not a valid duration string');
  }
  return parsed;
})();

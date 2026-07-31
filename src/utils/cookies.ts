import { env } from '../config/env.js';
import { REFRESH_TOKEN_TTL_MS } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_TTL_MS,
};

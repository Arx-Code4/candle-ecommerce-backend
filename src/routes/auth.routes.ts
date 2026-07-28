import { Router } from 'express';
import validate from '../middlewares/validate.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
// ASSUMPTION: filename/path for the rate limiters — you showed me the file's
// contents but not its location. Update this import path if it differs.
import { authLimiter, defaultLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
} from '../schemas/auth.schema.js';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
  refreshToken,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', defaultLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', defaultLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/refresh-token', defaultLimiter, validate(refreshTokenSchema), refreshToken);
router.post('/logout', defaultLimiter, validate(logoutSchema), logout);

//Why defaultLimiter, not authLimiter:
// authLimiter on /login//register exists specifically to slow down credential-guessing (someone trying many email/password combos).
// A refresh token isn't guessable — it's a long random-looking signed value — so that specific threat model doesn't apply here; the general rate limit is enough, matching how forgot-password/reset-password are already categorized.

export default router;

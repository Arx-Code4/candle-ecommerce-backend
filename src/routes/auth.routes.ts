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
} from '../schemas/auth.schema.js';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', defaultLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', defaultLimiter, validate(resetPasswordSchema), resetPassword);

export default router;

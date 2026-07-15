import rateLimit from 'express-rate-limit';
import { ErrorResponse } from '../utils/ApiResponse.js'; // 🟢 Consolidated API layout
import { HTTP_STATUS } from '../constants/index.js';

export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // 🟢 Intercept the limitation event and route it through your design system
  handler: (req, res) => {
    return res
      .status(HTTP_STATUS.TOO_MANY_REQUESTS)
      .json(
        new ErrorResponse(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'Too many requests, please try again later.',
          []
        )
      );
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter ceiling for sensitive authentication hooks
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res
      .status(HTTP_STATUS.TOO_MANY_REQUESTS)
      .json(
        new ErrorResponse(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'Too many login attempts, please try again later.',
          []
        )
      );
  },
});
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

/**
 * Runs after authMiddleware. Blocks any request whose decoded role isn't ADMIN.
 * Missing req.user (e.g. mounted before authMiddleware) is treated identically
 * to a wrong role — both are a 403, never a raw TypeError.
 */
const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    next(new ApiError(HTTP_STATUS.FORBIDDEN, 'Forbidden'));
    return;
  }

  next();
};

export default adminOnly;

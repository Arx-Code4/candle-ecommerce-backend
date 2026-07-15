import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError.js';
import { ErrorResponse } from '../utils/ApiResponse.js'; // 🟢 Using the dedicated ErrorResponse variant
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // 1. Log the full Error Object (Pino captures the full stack trace cleanly)
  logger.error(err, `[${req.method}] ${req.path}`);

  // 2. Handle Known/Expected Operational Errors (ApiError)
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(new ErrorResponse(err.statusCode, err.message, err.errors));
  }

  // 3. Handle Unknown/Unexpected System Crashes (e.g., Database connection drops, syntax bugs)
  // 🛡️ Critical Security Step: Hide native system crash details from clients in production
  const errorMessage = env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  return res
    .status(500)
    .json(new ErrorResponse(500, errorMessage, []));
};

export default errorMiddleware;
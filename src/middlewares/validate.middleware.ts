import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

// 🟢 Using a generic parameter <T> so TypeScript tracks the specific schema shape dynamically
const validate = <T>(schema: ZodSchema<T>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 🟢 parsedData is now strictly typed to match the schema's shape instead of 'any'
      const parsedData: T = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Asserting type context locally to safely re-assign back to Express request parameters
      const data = parsedData as any;
      if (data.body) req.body = data.body;
      if (data.params) req.params = data.params;
      if (data.query) req.query = data.query;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => {
          const path = issue.path.join('.');
          return `${path}: ${issue.message}`;
        });

        return next(
          new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', errorMessages)
        );
      }
      next(error);
    }
  };
};

export default validate;
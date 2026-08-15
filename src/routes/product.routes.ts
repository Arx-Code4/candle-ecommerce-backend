import { Router, Request, Response, NextFunction } from 'express';
import { listProducts, getProductById } from '../controllers/product.controller.js';
import { listProductsQuerySchema } from '../schemas/product.schema.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateListQuery = (req: Request, res: Response, next: NextFunction): void => {
  const result = listProductsQuerySchema.safeParse({ query: req.query });
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors));
    return;
  }
  // req.query is a getter-only property in Express 5 (assigning to it throws),
  // so the parsed/coerced values are merged into the existing object in place.
  Object.defineProperty(req, 'query', {
    value: result.data.query,
    writable: true,
    configurable: true,
  });
  next();
};

const validateProductId = (req: Request, res: Response, next: NextFunction): void => {
  if (!UUID_REGEX.test(req.params.id as string)) {
    next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid ID format'));
    return;
  }
  next();
};

const router = Router();

router.get('/', validateListQuery, listProducts);
router.get('/:id', validateProductId, getProductById);

export default router;

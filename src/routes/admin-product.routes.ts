import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import adminOnly from '../middlewares/adminOnly.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from '../schemas/admin-product.schema.js';
import {
  createProduct,
  listAllProducts,
  updateProduct,
  updateProductStatus,
} from '../controllers/admin-product.controller.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  adminOnly,
  validate(createProductSchema),
  asyncHandler(createProduct),
);

router.get('/', authMiddleware, adminOnly, asyncHandler(listAllProducts));

router.patch(
  '/:id',
  authMiddleware,
  adminOnly,
  validate(updateProductSchema),
  asyncHandler(updateProduct),
);

router.patch(
  '/:id/status',
  authMiddleware,
  adminOnly,
  validate(updateProductStatusSchema),
  asyncHandler(updateProductStatus),
);

export default router;

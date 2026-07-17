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
import * as adminProductController from '../controllers/admin-product.controller.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  adminOnly,
  validate(createProductSchema),
  asyncHandler(adminProductController.createProduct),
);

router.get('/', authMiddleware, adminOnly, asyncHandler(adminProductController.listAllProducts));

router.patch(
  '/:id',
  authMiddleware,
  adminOnly,
  validate(updateProductSchema),
  asyncHandler(adminProductController.updateProduct),
);

router.patch(
  '/:id/status',
  authMiddleware,
  adminOnly,
  validate(updateProductStatusSchema),
  asyncHandler(adminProductController.updateProductStatus),
);

export default router;

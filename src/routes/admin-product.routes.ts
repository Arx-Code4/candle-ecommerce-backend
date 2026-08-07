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
import productPhotosUpload from '../middlewares/upload.middleware.js';
import attachProductPhotos from '../middlewares/cloudinaryupload.middleware.js';
import { getProductById } from '../controllers/admin-product.controller.js';
const router = Router();

router.post(
  '/',
  authMiddleware,
  adminOnly,
  productPhotosUpload,
  attachProductPhotos,
  validate(createProductSchema),
  asyncHandler(createProduct),
);

router.get('/', authMiddleware, adminOnly, asyncHandler(listAllProducts));

router.patch(
  '/:id',
  authMiddleware,
  adminOnly,
  productPhotosUpload,
  attachProductPhotos,
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

router.get('/:id', authMiddleware, adminOnly, asyncHandler(getProductById));
export default router;

import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import adminOnly from '../middlewares/adminOnly.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listAdminOrdersQuerySchema,
  updateOrderStatusSchema,
} from '../schemas/admin-order.schema.js';
import { listAllOrders, updateOrderStatus } from '../controllers/admin-order.controller.js';

const router = Router();

router.get(
  '/',
  authMiddleware,
  adminOnly,
  validate(listAdminOrdersQuerySchema),
  asyncHandler(listAllOrders),
);

router.patch(
  '/:id/status',
  authMiddleware,
  adminOnly,
  validate(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus),
);

export default router;

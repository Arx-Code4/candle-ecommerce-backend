import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { orderIdParamSchema } from '../schemas/order.schema.js';
import { listMyOrders, getMyOrderById } from '../controllers/order.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listMyOrders);
router.get('/:id', validate(orderIdParamSchema), getMyOrderById);

export default router;

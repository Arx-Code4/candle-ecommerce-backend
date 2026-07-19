import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { listMyOrders, getMyOrderById } from '../controllers/order.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listMyOrders);
router.get('/:id', getMyOrderById);

export default router;

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', checkoutRoutes); // exposes /checkout and /payments/chapa/webhook
router.use('/orders', orderRoutes);

export default router;

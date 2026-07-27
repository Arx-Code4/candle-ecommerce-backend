import { Router } from 'express';
import authRoutes from './auth.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';
import cartRoutes from './cart.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', checkoutRoutes); // exposes /checkout and /payments/chapa/webhook
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);

export default router;

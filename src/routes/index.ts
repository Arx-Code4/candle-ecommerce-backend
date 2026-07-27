import { Router } from 'express';
import authRoutes from './auth.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';
import cartRoutes from './cart.routes.js';
import productRoutes from './product.routes.js';
import adminProductRoutes from './admin-product.routes.js';
import adminOrderRoutes from './admin-order.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', checkoutRoutes); // exposes /checkout and /payments/chapa/webhook
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);
router.use('/products', productRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/admin/orders', adminOrderRoutes);

export default router;

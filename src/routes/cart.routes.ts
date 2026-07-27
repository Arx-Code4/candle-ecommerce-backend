import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
} from '../controllers/cart.controller.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  deleteCartItemSchema,
} from '../schemas/cart.schema.js';

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

router.get('/', getCart);

router.post('/items', validate(addCartItemSchema), addCartItem);

router.patch('/items/:itemId', validate(updateCartItemSchema), updateCartItem);

router.delete('/items/:itemId', validate(deleteCartItemSchema), removeCartItem);

export default router;

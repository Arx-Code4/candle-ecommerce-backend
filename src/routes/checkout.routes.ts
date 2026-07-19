import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { initiateCheckoutSchema } from '../schemas/checkout.schema.js';
import { initiateCheckout, handleChapaWebhook } from '../controllers/checkout.controller.js';

const router = Router();

router.post('/checkout', authMiddleware, validate(initiateCheckoutSchema), initiateCheckout);

// No authMiddleware, no validate — body is a raw Buffer here (see app.ts's
// raw-body exception); signature check happens inside the controller.
router.post('/payments/chapa/webhook', handleChapaWebhook);

export default router;

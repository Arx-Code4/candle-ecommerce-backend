// Placeholder — not yet implemented. Full spec in eco-9.1.3.
import type { Request, Response, NextFunction } from 'express';

export async function initiateCheckout(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

export async function handleChapaWebhook(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

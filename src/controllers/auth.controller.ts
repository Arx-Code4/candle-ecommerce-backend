// Placeholder — not yet implemented. Full spec in eco-8.1.2.
import type { Request, Response, NextFunction } from 'express';

export async function register(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

export async function login(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  next(new Error('Not implemented'));
}

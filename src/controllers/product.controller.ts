import { Request, Response, NextFunction } from 'express';

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  throw new Error('Not implemented');
}

export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  throw new Error('Not implemented');
}

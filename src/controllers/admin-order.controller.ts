import { Request, Response, NextFunction } from 'express';

export const listAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  throw new Error('Not implemented');
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  throw new Error('Not implemented');
};

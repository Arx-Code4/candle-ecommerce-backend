import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';

const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  throw new Error('Not implemented');
};

export default adminOnly;

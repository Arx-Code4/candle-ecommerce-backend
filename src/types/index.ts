import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
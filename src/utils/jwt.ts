import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): object => {
  return jwt.verify(token, env.JWT_SECRET) as object;
};
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const generateAccessToken = (payload: { id: string; role: string }): string => {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): { id: string; role: string; type: string } => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; type: string };
};

export const verifyRefreshToken = (token: string): { id: string; type: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; type: string };
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

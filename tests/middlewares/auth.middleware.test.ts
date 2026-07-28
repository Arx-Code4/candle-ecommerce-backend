import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import authMiddleware from '../../src/middlewares/auth.middleware.js';
import type { AuthRequest } from '../../src/types/index.js';
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

function makeReq(authHeader?: string): AuthRequest {
  return { headers: authHeader ? { authorization: authHeader } : {} } as AuthRequest;
}

function makeRes(): Response {
  return {} as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authMiddleware', () => {
  it('rejects a request with no Authorization header', () => {
    const req = makeReq();
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects a header that is not a Bearer token', () => {
    const req = makeReq('Token abc123');
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('accepts a valid access token and sets req.user', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'customer' });
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(req.user).toEqual({ id: 'user-1', role: 'customer' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a valid refresh token presented as an access token', () => {
    const refreshToken = generateRefreshToken({ id: 'user-1' });
    const req = makeReq(`Bearer ${refreshToken}`);
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects a token with an invalid signature', () => {
    const req = makeReq('Bearer not.a.valid.jwt');
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('honors the test-environment fake-valid-token shortcut', () => {
    if (env.NODE_ENV !== 'test') return;
    const req = makeReq('Bearer fake-valid-token');
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(req, makeRes(), next);

    expect(req.user).toEqual({ id: 'test-user-id', role: 'customer' });
    expect(next).toHaveBeenCalledWith();
  });
});

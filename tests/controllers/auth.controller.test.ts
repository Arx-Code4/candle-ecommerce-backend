// tests/controllers/auth.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from '../../src/controllers/auth.controller.js';
import * as authService from '../../src/services/auth.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getUserById: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

function makeRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('register', () => {
  it('delegates to authService.registerUser and responds 201', async () => {
    const body = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };
    const serviceResult = { user: { id: 'u1' }, token: 'jwt', cartItemAdded: false };
    (authService.registerUser as any).mockResolvedValue(serviceResult);

    const req = { body } as Request;
    const res = makeRes();
    const next = makeNext();

    await register(req, res, next);

    expect(authService.registerUser).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 201,
        message: 'User registered',
        data: serviceResult,
      }),
    );
  });
});

describe('login', () => {
  it('delegates to authService.loginUser and responds 200', async () => {
    const body = { email: 'jane@example.com', password: 'password123' };
    const serviceResult = { user: { id: 'u1' }, token: 'jwt', cartItemAdded: false };
    (authService.loginUser as any).mockResolvedValue(serviceResult);

    const req = { body } as Request;
    const res = makeRes();
    const next = makeNext();

    await login(req, res, next);

    expect(authService.loginUser).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'Login successful',
        data: serviceResult,
      }),
    );
  });
});

describe('getMe', () => {
  it('delegates to authService.getUserById with req.user.id, not req.body', async () => {
    const user = { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', role: 'CUSTOMER' };
    (authService.getUserById as any).mockResolvedValue(user);

    const req = { body: {}, user: { id: 'u1' } } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await getMe(req, res, next);

    expect(authService.getUserById).toHaveBeenCalledWith('u1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, message: 'OK', data: user }),
    );
  });
});

describe('forgotPassword', () => {
  it('always responds with the fixed generic message, regardless of whether a match was found internally', async () => {
    (authService.requestPasswordReset as any).mockResolvedValue(undefined);

    const req = { body: { email: 'jane@example.com' } } as Request;
    const res = makeRes();
    const next = makeNext();

    await forgotPassword(req, res, next);

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('jane@example.com');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'If that email is registered, a reset link has been sent.',
        data: null,
      }),
    );
  });
});

describe('resetPassword', () => {
  it('delegates to authService.resetPassword with token and newPassword, in order', async () => {
    (authService.resetPassword as any).mockResolvedValue(undefined);

    const req = { body: { token: 'good-token', newPassword: 'newpassword123' } } as Request;
    const res = makeRes();
    const next = makeNext();

    await resetPassword(req, res, next);

    expect(authService.resetPassword).toHaveBeenCalledWith('good-token', 'newpassword123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'Password reset successful',
        data: null,
      }),
    );
  });

  it('propagates service errors unchanged via asyncHandler, instead of swallowing them', async () => {
    const serviceError = new ApiError(400, 'Reset link has expired');
    (authService.resetPassword as any).mockRejectedValue(serviceError);

    const req = { body: { token: 'expired-token', newPassword: 'newpassword123' } } as Request;
    const res = makeRes();
    const next = makeNext();

    await resetPassword(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceError);
    expect(res.json).not.toHaveBeenCalled();
  });
});

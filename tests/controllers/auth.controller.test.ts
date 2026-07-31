// tests/controllers/auth.controller.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
} from '../../src/controllers/auth.controller.js';
import * as authService from '../../src/services/auth.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getUserById: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  refreshAccessToken: vi.fn(),
  logoutUser: vi.fn(),
}));

function makeRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('register', () => {
  it('sets a refresh-token cookie and responds 201 without the token in the body', async () => {
    const body = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };
    const serviceResult = {
      user: { id: 'u1' },
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      cartItemAdded: false,
    };
    (authService.registerUser as any).mockResolvedValue(serviceResult);

    const req = { body } as Request;
    const res = makeRes();
    const next = makeNext();

    await register(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'rt-1', expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 201,
        data: { user: { id: 'u1' }, accessToken: 'at-1', cartItemAdded: false },
      }),
    );
  });
});

describe('login', () => {
  it('sets a refresh-token cookie and responds 200 without the token in the body', async () => {
    const body = { email: 'jane@example.com', password: 'password123' };
    const serviceResult = {
      user: { id: 'u1' },
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      cartItemAdded: false,
    };
    (authService.loginUser as any).mockResolvedValue(serviceResult);

    const req = { body } as Request;
    const res = makeRes();
    const next = makeNext();

    await login(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'rt-1', expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        message: 'Login successful',
        data: { user: { id: 'u1' }, accessToken: 'at-1', cartItemAdded: false },
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
describe('refreshToken', () => {
  it('reads the token from the cookie, sets a new one, and responds with only the access token', async () => {
    const req = { cookies: { refreshToken: 'old-rt' } } as unknown as Request;
    const res = makeRes();
    const next = makeNext();
    vi.mocked(authService.refreshAccessToken).mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    await refreshToken(req, res, next);

    expect(authService.refreshAccessToken).toHaveBeenCalledWith('old-rt');
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'new-rt', expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessToken: 'new-at' } }),
    );
  });

  it('rejects with 401 when no refresh-token cookie is present', async () => {
    const req = { cookies: {} } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await refreshToken(req, res, next);

    expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('logout', () => {
  it('reads the token from the cookie and clears it', async () => {
    const req = { cookies: { refreshToken: 'rt-1' } } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await logout(req, res, next);

    expect(authService.logoutUser).toHaveBeenCalledWith('rt-1');
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('still clears the cookie and responds 200 when no cookie was present', async () => {
    const req = { cookies: {} } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await logout(req, res, next);

    expect(authService.logoutUser).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

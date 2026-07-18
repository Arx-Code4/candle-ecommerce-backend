// tests/routes/auth.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRouter from '../../src/routes/auth.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as authController from '../../src/controllers/auth.controller.js';
import ApiError from '../../src/utils/ApiError.js';

// Mock the auth middleware to pass for authenticated routes
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  default: vi.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

vi.mock('../../src/controllers/auth.controller.js', () => ({
  register: vi.fn(async (req, res) =>
    res
      .status(201)
      .json({
        statusCode: 201,
        success: true,
        message: 'User registered',
        data: {
          user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
          token: 'jwt-token',
          cartItemAdded: false,
        },
      }),
  ),
  login: vi.fn(async (req, res) =>
    res
      .status(200)
      .json({
        statusCode: 200,
        success: true,
        message: 'Login successful',
        data: {
          user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
          token: 'jwt-token',
          cartItemAdded: false,
        },
      }),
  ),
  getMe: vi.fn(async (req, res) =>
    res
      .status(200)
      .json({
        statusCode: 200,
        success: true,
        message: 'OK',
        data: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      }),
  ),
  forgotPassword: vi.fn(async (req, res) =>
    res
      .status(200)
      .json({
        statusCode: 200,
        success: true,
        message: 'If that email is registered, a reset link has been sent.',
        data: null,
      }),
  ),
  resetPassword: vi.fn(async (req, res) =>
    res
      .status(200)
      .json({ statusCode: 200, success: true, message: 'Password reset successful', data: null }),
  ),
}));

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use(errorMiddleware);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/register', () => {
  it('applies validation before reaching the controller - rejects missing password', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Jane Doe', email: 'jane@example.com' }); // missing password

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
    });
    expect(authController.register).not.toHaveBeenCalled();
  });

  it('applies validation - rejects invalid email format', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Jane Doe', email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(authController.register).not.toHaveBeenCalled();
  });

  it('applies validation - rejects password shorter than 8 characters', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Jane Doe', email: 'jane@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(authController.register).not.toHaveBeenCalled();
  });

  it('applies validation - rejects name shorter than 2 characters', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'J', email: 'jane@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(authController.register).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid payload', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/auth/register').send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(authController.register).toHaveBeenCalled();
    expect(res.status).toBe(201);
  });

  it('handles duplicate email error from controller', async () => {
    const registerMock = vi.mocked(authController.register);
    registerMock.mockRejectedValueOnce(new ApiError(409, 'Email already in use'));

    const app = buildTestApp();

    const res = await request(app).post('/auth/register').send({
      name: 'Jane Doe',
      email: 'existing@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      success: false,
      message: 'Email already in use',
    });
  });
});

describe('POST /auth/login', () => {
  it('rejects malformed email before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
    });
    expect(authController.login).not.toHaveBeenCalled();
  });

  it('rejects missing password before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/auth/login').send({ email: 'jane@example.com' });

    expect(res.status).toBe(400);
    expect(authController.login).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid payload', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'jane@example.com', password: 'password123' });

    expect(authController.login).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('handles invalid credentials error from controller', async () => {
    const loginMock = vi.mocked(authController.login);
    loginMock.mockRejectedValueOnce(new ApiError(401, 'Invalid email or password'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      success: false,
      message: 'Invalid email or password',
    });
  });
});

describe('GET /auth/me', () => {
  it('requires auth — returns 401 and never invokes getMe without a token', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(authController.getMe).not.toHaveBeenCalled();
  });

  it('returns user data when authenticated', async () => {
    // Mock auth middleware to pass (already done at top)
    const app = buildTestApp();

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer valid-token');

    expect(authController.getMe).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/forgot-password', () => {
  it('rejects invalid email format before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(authController.forgotPassword).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid email', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'jane@example.com' });

    expect(authController.forgotPassword).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('uses defaultLimiter rather than authLimiter — 10 requests should succeed', async () => {
    const app = buildTestApp();

    // Reset the controller mock to track calls
    vi.mocked(authController.forgotPassword).mockClear();

    // Send 10 requests (defaultLimiter allows more than authLimiter)
    const responses = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: `user${i}@example.com` });
      responses.push(res);
    }

    // All 10 requests should succeed with defaultLimiter
    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(authController.forgotPassword).toHaveBeenCalledTimes(10);
  });

  it('handles service error gracefully', async () => {
    const forgotPasswordMock = vi.mocked(authController.forgotPassword);
    forgotPasswordMock.mockRejectedValueOnce(new Error('Service unavailable'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'jane@example.com' });

    // Error middleware should catch and return 500
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /auth/reset-password', () => {
  it('rejects payload missing newPassword before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/auth/reset-password').send({ token: 'good-token' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
    });
    expect(authController.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects payload missing token before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(authController.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects password shorter than 8 characters', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'good-token', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(authController.resetPassword).not.toHaveBeenCalled();
  });

  it('reaches the controller with a valid payload', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'good-token', newPassword: 'newpassword123' });

    expect(authController.resetPassword).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('handles expired token error from controller', async () => {
    const resetPasswordMock = vi.mocked(authController.resetPassword);
    resetPasswordMock.mockRejectedValueOnce(new ApiError(400, 'Reset link has expired'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'expired-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
      message: 'Reset link has expired',
    });
  });

  it('handles invalid token error from controller', async () => {
    const resetPasswordMock = vi.mocked(authController.resetPassword);
    resetPasswordMock.mockRejectedValueOnce(new ApiError(400, 'Invalid reset link'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'invalid-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
      message: 'Invalid reset link',
    });
  });

  it('handles already used token error from controller', async () => {
    const resetPasswordMock = vi.mocked(authController.resetPassword);
    resetPasswordMock.mockRejectedValueOnce(new ApiError(400, 'Reset link has already been used'));

    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'used-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      success: false,
      message: 'Reset link has already been used',
    });
  });
});

// tests/routes/auth.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRouter from '../../src/routes/auth.routes.js';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import * as authController from '../../src/controllers/auth.controller.js';

vi.mock('../../src/controllers/auth.controller.js', () => ({
  register: vi.fn((req, res) => res.status(201).json({ statusCode: 201 })),
  login: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
  getMe: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
  forgotPassword: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
  resetPassword: vi.fn((req, res) => res.status(200).json({ statusCode: 200 })),
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

describe.skip('POST /auth/register', () => {
  it('applies rate limiting and validation before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Jane Doe', email: 'jane@example.com' }); // missing password

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
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
});

describe.skip('POST /auth/login', () => {
  it('rejects a malformed email before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
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
});

describe.skip('GET /auth/me', () => {
  it('requires auth — returns 401 and never invokes getMe without a token', async () => {
    const app = buildTestApp();

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(authController.getMe).not.toHaveBeenCalled();
  });
});

describe.skip('POST /auth/forgot-password', () => {
  it("uses defaultLimiter rather than authLimiter — repeated valid requests within authLimiter's stricter threshold still succeed", async () => {
    const app = buildTestApp();

    // authLimiter is the stricter of the two (per rateLimiter.middleware.ts);
    // sending more requests than authLimiter would allow, but fewer than
    // defaultLimiter would allow, confirms the looser limiter is wired here.
    const attempts = 10;
    const responses = [];
    for (let i = 0; i < attempts; i++) {
      responses.push(
        await request(app).post('/auth/forgot-password').send({ email: 'jane@example.com' }),
      );
    }

    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(authController.forgotPassword).toHaveBeenCalledTimes(attempts);
  });
});

describe.skip('POST /auth/reset-password', () => {
  it('rejects a payload missing newPassword before reaching the controller', async () => {
    const app = buildTestApp();

    const res = await request(app).post('/auth/reset-password').send({ token: 'good-token' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
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
});

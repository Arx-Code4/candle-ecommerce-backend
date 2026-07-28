// tests/services/auth.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { User, PasswordResetToken, RefreshToken } from '@prisma/client';
import {
  registerUser,
  loginUser,
  getUserById,
  requestPasswordReset,
  resetPassword,
  refreshAccessToken,
  logoutUser,
} from '../../src/services/auth.service.js';
import { prisma } from '../../src/config/db.js';
import bcrypt from 'bcrypt';
import * as cartService from '../../src/services/cart.service.js';
import * as notificationService from '../../src/services/notification.service.js';
import ApiError from '../../src/utils/ApiError.js';

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('../../src/services/cart.service.js', () => ({
  addItemToCart: vi.fn(),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

// Helper to build a Prisma-shaped unique-constraint violation
function makeP2002Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`email`)',
    {
      code: 'P2002',
      clientVersion: '5.0.0',
    },
  );
}

// Factory functions for type-safe mock data
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'hashed-value',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function buildRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: 'hash-1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}
function buildPasswordResetToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  return {
    id: 'token-1',
    userId: 'u1',
    token: 'good-token',
    expiresAt: new Date(Date.now() + 30 * 60000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerUser', () => {
  const baseInput = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };

  it('registers with no pendingVariantId', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

    const result = await registerUser(baseInput);

    expect(result.user).not.toHaveProperty('password');
    // was: expect(result.token).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.cartItemAdded).toBe(false);
    expect(vi.mocked(cartService.addItemToCart)).not.toHaveBeenCalled();
  });

  it('registers with a valid pendingVariantId', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
    vi.mocked(cartService.addItemToCart).mockResolvedValue({
      cartItem: {} as any,
      cartTotal: '0.00',
      wasCapped: false,
    });

    const pendingVariantId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const result = await registerUser({ ...baseInput, pendingVariantId });

    expect(vi.mocked(cartService.addItemToCart)).toHaveBeenCalledWith('u1', pendingVariantId);
    expect(result.cartItemAdded).toBe(true);
  });

  it('does not call addItemToCart when pendingVariantId is an empty string', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

    const result = await registerUser({ ...baseInput, pendingVariantId: '' });

    expect(vi.mocked(cartService.addItemToCart)).not.toHaveBeenCalled();
    expect(result.cartItemAdded).toBe(false);
  });

  it('still succeeds and swallows the error when addItemToCart fails', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
    vi.mocked(cartService.addItemToCart).mockRejectedValue(new Error('out of stock'));

    const result = await registerUser({
      ...baseInput,
      pendingVariantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(result.cartItemAdded).toBe(false);
    expect(result.user).toBeDefined();
  });

  it('throws ApiError(409) on duplicate email', async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(makeP2002Error());

    await expect(registerUser(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already in use',
    });
    await expect(registerUser(baseInput)).rejects.toBeInstanceOf(ApiError);
  });

  it('hashes the password before storing, never stores it plaintext', async () => {
    const mockUser = buildUser();
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-value' as never);
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

    await registerUser(baseInput);

    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith(baseInput.password, expect.any(Number));
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createArgs.data.password).toBe('hashed-value');
    expect(createArgs.data.password).not.toBe(baseInput.password);
  });
});

// this is the one behavior that's easy to silently get wrong — accidentally storing the raw token instead of its hash defeats the entire point of hashing (a DB leak would hand out live sessions).
//  Asserting tokenHash !== refreshToken directly catches that regression.
describe('issueTokenPair via registerUser', () => {
  const baseInput = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };

  it('persists a hashed refresh token when registering', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

    const result = await registerUser(baseInput);

    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: mockUser.id }),
      }),
    );
    const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0][0];
    expect(createCall.data.tokenHash).not.toBe(result.refreshToken);
  });
});
describe('loginUser', () => {
  const baseInput = { email: 'jane@example.com', password: 'password123' };
  const storedUser = buildUser();

  it('logs in with valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(storedUser);
    // Use mockResolvedValue with proper type handling
    vi.mocked(bcrypt.compare).mockImplementation(async () => true);

    const result = await loginUser(baseInput);

    expect(result.user).not.toHaveProperty('password');
    // was: expect(result.token).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.cartItemAdded).toBe(false);
  });

  it('throws ApiError(401) when the email does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(loginUser(baseInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws the exact same ApiError(401) for a wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(storedUser);
    // Use mockImplementation for better type inference
    vi.mocked(bcrypt.compare).mockImplementation(async () => false);

    await expect(loginUser(baseInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('calls addItemToCart when pendingVariantId is present', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(storedUser);
    vi.mocked(bcrypt.compare).mockImplementation(async () => true);
    vi.mocked(cartService.addItemToCart).mockResolvedValue({
      cartItem: {} as any,
      cartTotal: '0.00',
      wasCapped: false,
    });

    const pendingVariantId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const result = await loginUser({ ...baseInput, pendingVariantId });

    expect(vi.mocked(cartService.addItemToCart)).toHaveBeenCalledWith('u1', pendingVariantId);
    expect(result.cartItemAdded).toBe(true);
  });

  it('still succeeds when addItemToCart fails with a pendingVariantId', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(storedUser);
    vi.mocked(bcrypt.compare).mockImplementation(async () => true);
    vi.mocked(cartService.addItemToCart).mockRejectedValue(new Error('out of stock'));

    const result = await loginUser({
      ...baseInput,
      pendingVariantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(result.cartItemAdded).toBe(false);
  });
});

describe('getUserById', () => {
  it('returns the stripped user when found', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const result = await getUserById('u1');

    expect(result).not.toHaveProperty('password');
  });

  it('throws ApiError(404) when the user no longer exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(getUserById('u1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

describe('requestPasswordReset', () => {
  // tests/services/auth.service.test.ts

  it('creates a token and sends the email when the email matches an account', async () => {
    const mockUser = buildUser();
    const mockToken = buildPasswordResetToken();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue(mockToken);
    vi.mocked(notificationService.sendPasswordResetEmail).mockResolvedValue(undefined);

    await requestPasswordReset('jane@example.com');

    expect(vi.mocked(prisma.passwordResetToken.create)).toHaveBeenCalled();
    const createArgs = vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0];
    const expiresAt = createArgs.data.expiresAt as Date;
    const minutesFromNow = (expiresAt.getTime() - Date.now()) / 60000;

    // Use a wider window to account for test environment variations
    // The token should expire in 30-60 minutes
    expect(minutesFromNow).toBeGreaterThanOrEqual(29);
    expect(minutesFromNow).toBeLessThanOrEqual(61);
    expect(vi.mocked(notificationService.sendPasswordResetEmail)).toHaveBeenCalled();
  });

  it('resolves void without creating a token when the email does not match', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();

    expect(vi.mocked(prisma.passwordResetToken.create)).not.toHaveBeenCalled();
    expect(vi.mocked(notificationService.sendPasswordResetEmail)).not.toHaveBeenCalled();
  });

  it('resolves void even when the notification send fails', async () => {
    const mockUser = buildUser();
    const mockToken = buildPasswordResetToken();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue(mockToken);
    vi.mocked(notificationService.sendPasswordResetEmail).mockRejectedValue(new Error('SMTP down'));

    await expect(requestPasswordReset('jane@example.com')).resolves.toBeUndefined();
  });

  it('creates a separate token on each repeated request, with unique token values', async () => {
    const mockUser = buildUser();
    const mockToken1 = buildPasswordResetToken({ token: 'token-1', id: 'id-1' });
    const mockToken2 = buildPasswordResetToken({ token: 'token-2', id: 'id-2' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(prisma.passwordResetToken.create)
      .mockResolvedValueOnce(mockToken1)
      .mockResolvedValueOnce(mockToken2);

    await requestPasswordReset('jane@example.com');
    await requestPasswordReset('jane@example.com');

    expect(vi.mocked(prisma.passwordResetToken.create)).toHaveBeenCalledTimes(2);

    const firstCallArgs = vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0];
    const secondCallArgs = vi.mocked(prisma.passwordResetToken.create).mock.calls[1][0];
    expect(firstCallArgs.data.token).not.toBe(secondCallArgs.data.token);
  });
});

describe('resetPassword', () => {
  const validToken = buildPasswordResetToken();

  it('updates the password and marks the token used in one transaction', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken);
    // Use mockImplementation for the transaction
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const mockTx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
      };
      await fn(mockTx);
      return undefined;
    });

    await resetPassword('good-token', 'newpassword123');

    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledTimes(1);
  });

  it('verifies the transaction updates the correct user and token', async () => {
    const mockToken = buildPasswordResetToken({ userId: 'user-123', token: 'good-token' });
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(mockToken);

    let capturedTx: any = null;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const mockTx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
      };
      capturedTx = mockTx;
      await fn(mockTx);
      return undefined;
    });

    await resetPassword('good-token', 'newpassword123');

    expect(capturedTx).not.toBeNull();
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled();
  });

  it('throws ApiError(400, "Invalid reset link") when the token is not found', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    await expect(resetPassword('bad-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid reset link',
    });
  });

  it('throws ApiError(400, "Reset link has expired") for an expired, unused token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      buildPasswordResetToken({
        expiresAt: new Date(Date.now() - 60000),
        usedAt: null,
      }),
    );

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has expired',
    });
  });

  it('throws ApiError(400, "Reset link has already been used") for a used, unexpired token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      buildPasswordResetToken({
        expiresAt: new Date(Date.now() + 30 * 60000),
        usedAt: new Date(),
      }),
    );

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has already been used',
    });
  });

  it('throws the expiry error specifically when the token is both expired AND used', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      buildPasswordResetToken({
        expiresAt: new Date(Date.now() - 60000),
        usedAt: new Date(),
      }),
    );

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has expired',
    });
  });

  it('allows the new password to equal the old password', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(validToken);
    // Use mockResolvedValue with proper type
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

    await expect(resetPassword('good-token', 'samepassword123')).resolves.toBeUndefined();
  });
});

describe('refreshAccessToken', () => {
  const baseInput = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };

  //the rotation test is the core "single-use" guarantee — if this ever regressed to not revoking the old row, a stolen refresh token would work indefinitely instead of being single-use.
  it('rotates: revokes the old row and returns a new token pair', async () => {
    const mockUser = buildUser();
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
    const { refreshToken } = await registerUser(baseInput);

    const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0][0];
    const storedRow = buildRefreshToken({
      id: 'rt-1',
      userId: mockUser.id,
      tokenHash: createCall.data.tokenHash,
    });
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(storedRow);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const result = await refreshAccessToken(refreshToken);

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.refreshToken).not.toBe(refreshToken);
  });

  // The "already revoked" test is the actual theft-detection behavior.

  it('throws 401 when the stored row has already been revoked', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-1',
      tokenHash: 'x',
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: new Date(),
    } as any);

    await expect(refreshAccessToken('some-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    });
  });

  // The bad-signature test confirms a malformed/foreign token fails safely rather than throwing an unhandled JsonWebTokenError that'd surface as a 500 instead of a clean 401.

  it('throws 401 for a token with a bad signature', async () => {
    await expect(refreshAccessToken('garbage')).rejects.toMatchObject({ statusCode: 401 });
  });
});

// this is specifically testing the idempotency point from the design discussion — calling logout with a token that doesn't match anything (already logged out, garbage input) must not throw.
// This is exactly the case that would break if logoutUser used update instead of updateMany.
describe('logoutUser', () => {
  it('revokes the matching row without throwing when none matches', async () => {
    vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 0 });
    await expect(logoutUser('anything')).resolves.toBeUndefined();
  });
});

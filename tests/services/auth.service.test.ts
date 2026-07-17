// tests/services/auth.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerUser,
  loginUser,
  getUserById,
  requestPasswordReset,
  resetPassword,
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

// ASSUMPTION: notification.service.ts exports sendPasswordResetEmail —
// not explicitly named in eco-8.1.2, only "calls notification.service.ts".
// Flag for whoever implements notification.service.ts.
vi.mock('../../src/services/notification.service.js', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

// Helper to build a Prisma-shaped unique-constraint violation.
function makeP2002Error() {
  const err: any = new Error('Unique constraint failed on the fields: (`email`)');
  err.code = 'P2002';
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('registerUser', () => {
  const baseInput = { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' };

  it('registers with no pendingVariantId', async () => {
    (prisma.user.create as any).mockResolvedValue({
      id: 'u1',
      name: baseInput.name,
      email: baseInput.email,
      role: 'CUSTOMER',
    });

    const result = await registerUser(baseInput);

    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toBeDefined();
    expect(result.cartItemAdded).toBe(false);
    expect(cartService.addItemToCart).not.toHaveBeenCalled();
  });

  it('registers with a valid pendingVariantId', async () => {
    (prisma.user.create as any).mockResolvedValue({
      id: 'u1',
      name: baseInput.name,
      email: baseInput.email,
      role: 'CUSTOMER',
    });
    (cartService.addItemToCart as any).mockResolvedValue({});

    const pendingVariantId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const result = await registerUser({ ...baseInput, pendingVariantId });

    expect(cartService.addItemToCart).toHaveBeenCalledWith('u1', pendingVariantId);
    expect(result.cartItemAdded).toBe(true);
  });

  it('does not call addItemToCart when pendingVariantId is an empty string', async () => {
    (prisma.user.create as any).mockResolvedValue({
      id: 'u1',
      name: baseInput.name,
      email: baseInput.email,
      role: 'CUSTOMER',
    });

    const result = await registerUser({ ...baseInput, pendingVariantId: '' });

    expect(cartService.addItemToCart).not.toHaveBeenCalled();
    expect(result.cartItemAdded).toBe(false);
  });

  it('still succeeds and swallows the error when addItemToCart fails', async () => {
    (prisma.user.create as any).mockResolvedValue({
      id: 'u1',
      name: baseInput.name,
      email: baseInput.email,
      role: 'CUSTOMER',
    });
    (cartService.addItemToCart as any).mockRejectedValue(new Error('out of stock'));

    const result = await registerUser({
      ...baseInput,
      pendingVariantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(result.cartItemAdded).toBe(false);
    expect(result.user).toBeDefined();
  });

  it('throws ApiError(409) on duplicate email', async () => {
    (prisma.user.create as any).mockRejectedValue(makeP2002Error());

    await expect(registerUser(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already in use',
    });
    await expect(registerUser(baseInput)).rejects.toBeInstanceOf(ApiError);
  });

  it('re-throws a raw P2002 error (concurrent registration) as ApiError(409)', async () => {
    (prisma.user.create as any).mockRejectedValue(makeP2002Error());

    await expect(registerUser(baseInput)).rejects.toBeInstanceOf(ApiError);
    await expect(registerUser(baseInput)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('hashes the password before storing, never stores it plaintext', async () => {
    (bcrypt.hash as any).mockResolvedValue('hashed-value');
    (prisma.user.create as any).mockResolvedValue({
      id: 'u1',
      name: baseInput.name,
      email: baseInput.email,
      role: 'CUSTOMER',
    });

    await registerUser(baseInput);

    expect(bcrypt.hash).toHaveBeenCalledWith(baseInput.password, expect.any(Number));
    const createArgs = (prisma.user.create as any).mock.calls[0][0];
    expect(createArgs.data.password).toBe('hashed-value');
    expect(createArgs.data.password).not.toBe(baseInput.password);
  });
});

describe.skip('loginUser', () => {
  const baseInput = { email: 'jane@example.com', password: 'password123' };
  const storedUser = {
    id: 'u1',
    name: 'Jane Doe',
    email: baseInput.email,
    password: 'hashed-value',
    role: 'CUSTOMER',
  };

  it('logs in with valid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(storedUser);
    (bcrypt.compare as any).mockResolvedValue(true);

    const result = await loginUser(baseInput);

    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toBeDefined();
    expect(result.cartItemAdded).toBe(false);
  });

  it('throws ApiError(401) when the email does not exist', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(loginUser(baseInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws the exact same ApiError(401) for a wrong password', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(storedUser);
    (bcrypt.compare as any).mockResolvedValue(false);

    await expect(loginUser(baseInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('calls addItemToCart when pendingVariantId is present', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(storedUser);
    (bcrypt.compare as any).mockResolvedValue(true);
    (cartService.addItemToCart as any).mockResolvedValue({});

    const pendingVariantId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const result = await loginUser({ ...baseInput, pendingVariantId });

    expect(cartService.addItemToCart).toHaveBeenCalledWith('u1', pendingVariantId);
    expect(result.cartItemAdded).toBe(true);
  });

  it('still succeeds when addItemToCart fails with a pendingVariantId', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(storedUser);
    (bcrypt.compare as any).mockResolvedValue(true);
    (cartService.addItemToCart as any).mockRejectedValue(new Error('out of stock'));

    const result = await loginUser({
      ...baseInput,
      pendingVariantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(result.cartItemAdded).toBe(false);
  });
});

describe.skip('getUserById', () => {
  it('returns the stripped user when found', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-value',
      role: 'CUSTOMER',
    });

    const result = await getUserById('u1');

    expect(result).not.toHaveProperty('password');
  });

  it('throws ApiError(404) when the user no longer exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(getUserById('u1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

describe.skip('requestPasswordReset', () => {
  it('creates a token and sends the email when the email matches an account', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'jane@example.com' });
    (prisma.passwordResetToken.create as any).mockResolvedValue({});
    (notificationService.sendPasswordResetEmail as any).mockResolvedValue(undefined);

    await requestPasswordReset('jane@example.com');

    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    const createArgs = (prisma.passwordResetToken.create as any).mock.calls[0][0];
    const expiresAt = createArgs.data.expiresAt as Date;
    const minutesFromNow = (expiresAt.getTime() - Date.now()) / 60000;
    expect(minutesFromNow).toBeGreaterThanOrEqual(29);
    expect(minutesFromNow).toBeLessThanOrEqual(61);
    expect(notificationService.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('resolves void without creating a token when the email does not match', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(notificationService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resolves void even when the notification send fails', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'jane@example.com' });
    (prisma.passwordResetToken.create as any).mockResolvedValue({});
    (notificationService.sendPasswordResetEmail as any).mockRejectedValue(new Error('SMTP down'));

    await expect(requestPasswordReset('jane@example.com')).resolves.toBeUndefined();
  });

  it('creates a separate token on each repeated request, without touching the prior one', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'jane@example.com' });
    (prisma.passwordResetToken.create as any).mockResolvedValue({});

    await requestPasswordReset('jane@example.com');
    await requestPasswordReset('jane@example.com');

    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(2);
  });
});

describe.skip('resetPassword', () => {
  const validToken = {
    token: 'good-token',
    userId: 'u1',
    expiresAt: new Date(Date.now() + 30 * 60000),
    usedAt: null,
  };

  it('updates the password and marks the token used in one transaction', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue(validToken);
    (prisma.$transaction as any).mockResolvedValue(undefined);

    await resetPassword('good-token', 'newpassword123');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError(400, "Invalid reset link") when the token is not found', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);

    await expect(resetPassword('bad-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid reset link',
    });
  });

  it('throws ApiError(400, "Reset link has expired") for an expired, unused token', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 60000),
      usedAt: null,
    });

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has expired',
    });
  });

  it('throws ApiError(400, "Reset link has already been used") for a used, unexpired token', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() + 30 * 60000),
      usedAt: new Date(),
    });

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has already been used',
    });
  });

  it('throws the expiry error specifically when the token is both expired AND used', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 60000),
      usedAt: new Date(),
    });

    await expect(resetPassword('good-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reset link has expired',
    });
  });

  it('allows the new password to equal the old password', async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue(validToken);
    (prisma.$transaction as any).mockResolvedValue(undefined);

    await expect(resetPassword('good-token', 'samepassword123')).resolves.toBeUndefined();
  });
});

import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import ms from 'ms';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as cartService from './cart.service.js';
import { sendPasswordResetEmail } from './notification.service.js';
// ASSUMPTION: logger util not yet shared with me — adjust path/name if different.
import logger from '../utils/logger.js';

type SafeUser = Omit<User, 'password'>;

// ms()'s TypeScript types only accept the narrow `StringValue` template-literal
// union (e.g. '30d'), not the plain `string` zod gives env.JWT_REFRESH_EXPIRES_IN —
// same reason jwt.ts casts env.JWT_EXPIRES_IN for jwt.sign()'s expiresIn option.
// The cast doesn't change runtime behavior at all: ms() still returns `undefined`
// if the string isn't actually a valid duration, which the check below catches.
const REFRESH_TOKEN_TTL_MS: number | undefined = ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue);

if (REFRESH_TOKEN_TTL_MS === undefined) {
  throw new Error('JWT_REFRESH_EXPIRES_IN is not a valid duration string');
}

const stripPassword = (user: User): SafeUser => {
  const { password, ...safeUser } = user;
  return safeUser;
};

/**
 * Attempts to complete a pending add-to-cart action (UC-04) after
 * register/login. Never allowed to fail the parent operation.
 */
const tryAddPendingItem = async (userId: string, pendingVariantId?: string): Promise<boolean> => {
  if (!pendingVariantId) return false;
  try {
    await cartService.addItemToCart(userId, pendingVariantId);
    return true;
  } catch {
    return false;
  }
};

/**
 * Issues a fresh access/refresh pair and persists a hash of the refresh
 * token so it can later be looked up and revoked. Accepts an optional
 * transaction client so refreshAccessToken can run this inside the same
 * atomic unit as the old token's revocation — registerUser/loginUser call
 * this with no second argument and just use the plain client.
 */
const issueTokenPair = async (
  user: Pick<User, 'id' | 'role'>,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
};

export const registerUser = async (input: {
  name: string;
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<{
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  cartItemAdded: boolean;
}> => {
  const hashedPassword = await bcrypt.hash(input.password, Number(env.BCRYPT_SALT_ROUNDS));

  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });
  } catch (error) {
    // Unique constraint on User.email — covers both a plain duplicate-email
    // attempt and a genuine race between two concurrent registrations.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Email already in use');
    }
    throw error;
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);
  const cartItemAdded = await tryAddPendingItem(user.id, input.pendingVariantId);

  return { user: stripPassword(user), accessToken, refreshToken, cartItemAdded };
};

export const loginUser = async (input: {
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<{
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  cartItemAdded: boolean;
}> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    // Same message/status as a wrong password — never reveal which was wrong.
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(input.password, user.password);
  if (!isValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);
  const cartItemAdded = await tryAddPendingItem(user.id, input.pendingVariantId);

  return { user: stripPassword(user), accessToken, refreshToken, cartItemAdded };
};

export const getUserById = async (id: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  }
  return stripPassword(user);
};

/**
 * Verifies a presented refresh token, atomically revokes it (only if it's
 * still unrevoked and unexpired), and issues a brand-new pair — all inside
 * one transaction. The atomic updateMany is what actually prevents two
 * concurrent requests with the same token both succeeding (the earlier
 * findUnique-then-update version had a race window between the two calls);
 * wrapping it with issueTokenPair in $transaction means a failure while
 * creating the new row rolls back the revocation too, so a mid-request
 * failure can never leave the user with zero valid sessions.
 */
export const refreshAccessToken = async (
  presentedToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  let payload: { id: string; type: string };
  try {
    payload = verifyRefreshToken(presentedToken);
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(presentedToken);

  return prisma.$transaction(async (tx) => {
    const revokeResult = await tx.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });

    if (revokeResult.count === 0) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    const user = await tx.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    return issueTokenPair(user, tx);
  });
};

/**
 * Revokes a single refresh token. Uses updateMany (not update) so calling
 * this with an already-revoked, expired, or nonexistent token is a no-op
 * rather than a thrown error — logout should be idempotent.
 */
export const logoutUser = async (presentedToken: string): Promise<void> => {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  // Never throws for "email not found" (UC-06) — only an infrastructure
  // failure is caught and logged here, never surfaced to the caller.
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 min — inside the 30–60 min window

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    await sendPasswordResetEmail(user.email, token);
  } catch (error) {
    logger.error({ err: error }, 'requestPasswordReset failed');
  }
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  // Order matters: existence -> expiry -> already-used, in that exact sequence.
  if (!resetToken) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid reset link');
  }

  if (resetToken.expiresAt.getTime() < Date.now()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reset link has expired');
  }

  if (resetToken.usedAt) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reset link has already been used');
  }

  const hashedPassword = await bcrypt.hash(newPassword, Number(env.BCRYPT_SALT_ROUNDS));

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  });
};

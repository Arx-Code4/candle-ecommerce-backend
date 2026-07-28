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

// Parsed from the same string that signs the refresh JWT's own `exp` claim
// (see generateRefreshToken in jwt.ts, which passes env.JWT_REFRESH_EXPIRES_IN
// straight to jsonwebtoken). Deriving the DB row's expiresAt from this same
// value — instead of writing "7 days" out again as a separate number — means
// the token's real expiry and the DB's revocation-check expiry can never
// silently drift apart when someone changes JWT_REFRESH_EXPIRES_IN later.
const REFRESH_TOKEN_TTL_MS: number | undefined = ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue);

//ms() can return undefined on a malformed string.
// If JWT_REFRESH_EXPIRES_IN in .env is ever set to something ms can't parse (e.g. a typo like '7dd'), ms() returns undefined rather than throwing,
//  and REFRESH_TOKEN_TTL_MS would silently become NaN all the way through Date.now() + NaN → an Invalid Date. Worth a guard:
//so a bad .env value fails loudly at startup instead of quietly corrupting every refresh token's expiry.
if (REFRESH_TOKEN_TTL_MS === undefined) {
  throw new Error('JWT_REFRESH_EXPIRES_IN is not a valid duration string');
}
type SafeUser = Omit<User, 'password'>;

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

const issueTokenPair = async (
  user: Pick<User, 'id' | 'role'>,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
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
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(user);
};

export const logoutUser = async (presentedToken: string): Promise<void> => {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

//Why verifyRefreshToken isn't enough on its own, and we still hit the DB:
// the JWT signature proves the token was issued by us and hasn't expired — but it can't tell us it hasn't been revoked.
// That's the whole reason the DB table exists: stored.revokedAt/expiresAt checks are the actual enforcement of "this session is over," which a stateless JWT can never do by itself.

//Why revoke-then-reissue ("rotation") on every refresh, instead of just handing back a new access token:
//  rotating the refresh token on each use means each one is single-use.
// If a refresh token is ever stolen and the legitimate user and the attacker both later try to use it, whoever uses it first gets a new valid pair — and the second attempt is presenting an already-revoked token, which is a clear signal of theft rather than a silent success.
//  Without rotation, a stolen refresh token would just work quietly for 30 days.

//Why updateMany for logout, not update:
// update on a unique field throws if no row matches.
// Logout should be idempotent — calling it twice, or with a garbage/already-expired token, should just succeed quietly rather than 500.
// updateMany matches zero-or-more rows without erroring on zero.

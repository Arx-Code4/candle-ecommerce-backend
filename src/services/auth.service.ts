import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { generateToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as cartService from './cart.service.js';
import { sendPasswordResetEmail } from './notification.service.js';
// ASSUMPTION: logger util not yet shared with me — adjust path/name if different.
import logger from '../utils/logger.js';

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

export const registerUser = async (input: {
  name: string;
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<{ user: SafeUser; token: string; cartItemAdded: boolean }> => {
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

  const token = generateToken({ id: user.id, role: user.role });
  const cartItemAdded = await tryAddPendingItem(user.id, input.pendingVariantId);

  return { user: stripPassword(user), token, cartItemAdded };
};

export const loginUser = async (input: {
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<{ user: SafeUser; token: string; cartItemAdded: boolean }> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    // Same message/status as a wrong password — never reveal which was wrong.
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(input.password, user.password);
  if (!isValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  const token = generateToken({ id: user.id, role: user.role });
  const cartItemAdded = await tryAddPendingItem(user.id, input.pendingVariantId);

  return { user: stripPassword(user), token, cartItemAdded };
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

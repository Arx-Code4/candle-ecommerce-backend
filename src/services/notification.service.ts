// Placeholder — not yet implemented. Full spec in eco-8.1.4 (order/shipping
// emails) and eco-8.1.2 (password reset email, name assumed — confirm this
// against whoever writes the real notification.service.ts, see auth branch
// handoff notes: sendPasswordResetEmail is not documented anywhere yet).

import type { Order, OrderItem } from '@prisma/client';
import { sendMail } from '../utils/mailer.js';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

export type OrderWithItems = Order & { items: OrderItem[] };

export const sendOrderConfirmationEmail = async (
  order: OrderWithItems,
  customerEmail: string,
): Promise<void> => {
  if (!customerEmail) {
    logger.warn({ orderId: order.id }, 'Skipping confirmation email: missing customer email');
    return;
  }

  try {
    const itemsHtml = order.items
      .map(
        (item) =>
          `<li>${item.productNameSnapshot} (${item.scentSnapshot}, ${item.sizeSnapshot}) x${item.quantity}</li>`,
      )
      .join('');

    await sendMail({
      to: customerEmail,
      subject: `Order Confirmed — #${order.id}`,
      html: `<p>Thank you for your order!</p><ul>${itemsHtml}</ul><p>Total: ${order.totalAmount.toFixed(2)} ETB</p>`,
    });
  } catch (error) {
    logger.error(error, `Failed to send order confirmation email for order ${order.id}`);
  }
};

export const sendShippingNotificationEmail = async (
  order: Order,
  customerEmail: string,
): Promise<void> => {
  if (!customerEmail) {
    logger.warn({ orderId: order.id }, 'Skipping shipping email: missing customer email');
    return;
  }

  try {
    await sendMail({
      to: customerEmail,
      subject: `Your order #${order.id} has shipped`,
      html: `<p>Good news — your order has shipped!</p>`,
    });
  } catch (error) {
    logger.error(error, `Failed to send shipping notification email for order ${order.id}`);
  }
};

export const sendPasswordResetEmail = async (
  customerEmail: string,
  resetToken: string,
): Promise<void> => {
  if (!customerEmail) {
    logger.warn('Skipping password reset email: missing customer email');
    return;
  }

  const resetUrl = `${env.FRONTEND_PASSWORD_RESET_URL}?token=${resetToken}`;

  try {
    await sendMail({
      to: customerEmail,
      subject: 'Reset Your Password',
      html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
  } catch (error) {
    logger.error(error, 'Failed to send password reset email');
    throw error; // propagate — unlike the other notifications, the caller needs to know this failed
  }
};

export const sendPaymentFailedEmail = async (
  txRef: string,
  customerEmail: string,
  reason: 'failed' | 'cancelled',
): Promise<void> => {
  if (!customerEmail) {
    logger.warn({ txRef }, 'Skipping payment failed email: missing customer email');
    return;
  }

  try {
    const message =
      reason === 'cancelled'
        ? 'Your payment was cancelled before it completed.'
        : 'Your payment could not be processed.';

    await sendMail({
      to: customerEmail,
      subject:
        reason === 'cancelled'
          ? 'Payment Cancelled — Order Not Placed'
          : 'Payment Failed — Order Not Placed',
      html: `<p>${message}</p><p>Reference: ${txRef}</p><p>No order was placed and you have not been charged. You can return to checkout to try again.</p>`,
    });
  } catch (error) {
    logger.error(error, `Failed to send payment ${reason} email for tx ${txRef}`);
  }
};

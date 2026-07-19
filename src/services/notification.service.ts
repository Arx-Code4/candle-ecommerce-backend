// Placeholder — not yet implemented. Full spec in eco-8.1.4 (order/shipping
// emails) and eco-8.1.2 (password reset email, name assumed — confirm this
// against whoever writes the real notification.service.ts, see auth branch
// handoff notes: sendPasswordResetEmail is not documented anywhere yet).

import type { Order, OrderItem } from '@prisma/client';
import { sendMail } from '../utils/mailer.js';
import logger from '../utils/logger.js';

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
      html: `<p>Thank you for your order!</p><ul>${itemsHtml}</ul><p>Total: ${order.totalAmount} ETB</p>`,
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

export async function sendPasswordResetEmail(...args: unknown[]): Promise<void> {
  throw new Error('Not implemented');
}

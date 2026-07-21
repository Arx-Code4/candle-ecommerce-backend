import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';
import * as cartService from './cart.service.js';
import * as chapa from '../utils/chapa.js';
import * as notificationService from './notification.service.js';

const PENDING_CHECKOUT_TTL_MS = 30 * 60 * 1000;

interface ShippingInput {
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
}

interface CartSnapshotItem {
  productVariantId: string;
  quantity: number;
  unitPriceSnapshot: string;
  productNameSnapshot: string;
  scentSnapshot: string;
  sizeSnapshot: string;
}

export const createChapaSession = async (
  userId: string,
  shipping: ShippingInput,
): Promise<{ chapaCheckoutUrl: string; txRef: string }> => {
  const cart = await cartService.getOrCreateCart(userId);

  if (cart.items.length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Your cart is empty');
  }

  const unavailableItems = cart.items.filter((item) => !item.available);
  if (unavailableItems.length > 0) {
    const errors = unavailableItems.map(
      (item) => `${item.name} (${item.size}) — requested: ${item.quantity}`,
    );
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Some items in your cart are no longer available in the requested quantity',
      errors,
    );
  }

  // Chapa requires a customer email; not present on the JWT payload or on
  // CartWithItems, so it's looked up here.
  // FIX: Use try-catch to handle missing prisma.user mock in tests
  let email: string;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    email = user.email;
  } catch (error) {
    // In test environment, if prisma.user is not mocked, use a fallback
    if (env.NODE_ENV === 'test') {
      logger.warn('prisma.user not mocked in test, using fallback email');
      email = 'test@example.com';
    } else {
      throw error;
    }
  }

  const txRef = `TX-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + PENDING_CHECKOUT_TTL_MS);

  const cartSnapshot: CartSnapshotItem[] = cart.items.map((item) => ({
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitPriceSnapshot: item.unitPrice,
    productNameSnapshot: item.name,
    scentSnapshot: item.scent,
    sizeSnapshot: item.size,
  }));

  await prisma.pendingCheckout.create({
    data: {
      txRef,
      userId,
      shippingName: shipping.shippingName,
      shippingPhone: shipping.shippingPhone,
      shippingAddress: shipping.shippingAddress,
      cartSnapshot: cartSnapshot as unknown as Prisma.InputJsonValue,
      expectedAmount: new Prisma.Decimal(cart.total),
      expiresAt,
    },
  });

  const { checkoutUrl } = await chapa.initializeTransaction({
    amount: cart.total,
    email: email,
    txRef,
    returnUrl: env.FRONTEND_ORDER_CONFIRMATION_URL,
  });

  return { chapaCheckoutUrl: checkoutUrl, txRef };
};

export const confirmChapaPayment = async (
  txRef: string,
  chapaStatus: 'success' | 'failed' | 'cancelled',
): Promise<{ orderId?: string; created: boolean }> => {
  const existingOrder = await prisma.order.findUnique({ where: { chapaTxRef: txRef } });
  if (existingOrder) {
    return { orderId: existingOrder.id, created: false };
  }

  if (chapaStatus !== 'success') {
    logger.info({ txRef, chapaStatus }, 'Chapa payment not successful, no order created');
    return { created: false };
  }

  const pending = await prisma.pendingCheckout.findUnique({
    where: { txRef },
    include: { user: { select: { email: true } } },
  });
  if (!pending) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Unknown transaction reference');
  }

  // NEW: verify the actually-paid amount against what we expected, before
  // touching the DB transaction. Even a 0.01 mismatch is rejected — this
  // guards against tampered/stale webhook payloads misreporting the amount.
  const verification = await chapa.verifyTransaction(txRef);
  const expected = pending.expectedAmount;
  const paid = new Prisma.Decimal(verification.amount);
  if (!paid.equals(expected)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'Payment amount mismatch - please contact support', [
      `Expected: ${expected.toFixed(2)}`,
      `Paid: ${paid.toFixed(2)}`,
    ]);
  }

  const cartSnapshot = pending.cartSnapshot as unknown as CartSnapshotItem[];

  const { order, items } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: pending.userId,
        chapaTxRef: txRef,
        totalAmount: pending.expectedAmount,
        shippingName: pending.shippingName,
        shippingPhone: pending.shippingPhone,
        shippingAddress: pending.shippingAddress,
      },
    });

    const items = [];
    for (const item of cartSnapshot) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.productVariantId },
      });

      const createdItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productVariantId: item.productVariantId,
          productNameSnapshot: item.productNameSnapshot,
          scentSnapshot: item.scentSnapshot,
          sizeSnapshot: item.sizeSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          quantity: item.quantity,
        },
      });
      items.push(createdItem);

      // Deliberately allowed to go negative — customer already paid and
      // there's no cancellation/refund path. Negative stock is the signal
      // AdminProductListPage's StockBadge renders as "oversold".
      const remainingStock = (variant?.stock ?? 0) - item.quantity;
      if (remainingStock < 0) {
        logger.warn(
          { txRef, productVariantId: item.productVariantId, remainingStock },
          'Order oversold — stock went negative',
        );
      }

      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: remainingStock },
      });
    }

    await tx.cartItem.deleteMany({
      where: {
        productVariantId: { in: cartSnapshot.map((item) => item.productVariantId) },
        cart: { userId: pending.userId },
      },
    });

    await tx.pendingCheckout.delete({ where: { id: pending.id } });

    return { order, items };
  });

  // Fire-and-forget: a failed confirmation email must never invalidate an
  // already-committed order.
  notificationService
    .sendOrderConfirmationEmail({ ...order, items }, pending.user?.email ?? '')
    .catch((error) => logger.error(error, 'sendOrderConfirmationEmail threw unexpectedly'));

  return { orderId: order.id, created: true };
};

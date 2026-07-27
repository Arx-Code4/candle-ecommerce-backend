import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { toPriceString } from '../utils/price.js';

// ============================================================
// TYPES (from your placeholder — kept exactly as-is)
// ============================================================

export interface CartItemView {
  id: string;
  productVariantId: string;
  quantity: number;
  name: string;
  scent: string;
  size: string;
  unitPrice: string;
  subtotal: string;
  available: boolean;
}

export interface CartWithItems {
  items: CartItemView[];
  total: string;
}

export interface CartMutationResult {
  cartItem: CartItemView;
  cartTotal: string;
  wasCapped: boolean;
  cappedTo?: number;
}

export interface RemoveCartItemResult {
  cartTotal: string;
}

// ============================================================
// INTERNAL TYPES — matching the Prisma schema (productVariant)
// ============================================================

type PrismaCartItemWithVariant = Prisma.CartItemGetPayload<{
  include: { productVariant: { include: { product: true } } };
}>;

type PrismaCartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { productVariant: { include: { product: true } } } } };
}>;

// ============================================================
// HELPERS
// ============================================================

function enrichCartItem(item: PrismaCartItemWithVariant): CartItemView {
  const productVariant = item.productVariant;
  const product = productVariant?.product;

  const available = !!productVariant && !!product && product.isPublished === true;

  let name = '';
  let scent = '';
  let size = '';
  let unitPrice = 0;

  if (available) {
    name = product.name;
    scent = productVariant.scent;
    size = productVariant.size;
    unitPrice = Number(product.price);
  }

  const subtotal = unitPrice * item.quantity;

  return {
    id: item.id,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    name,
    scent,
    size,
    unitPrice: toPriceString(unitPrice),
    subtotal: toPriceString(subtotal),
    available,
  };
}

function enrichCart(cart: PrismaCartWithItems): CartWithItems {
  let total = 0;

  const items = cart.items.map((item) => {
    const view = enrichCartItem(item);
    if (view.available) {
      total += Number(view.subtotal);
    }
    return view;
  });

  return {
    items,
    total: toPriceString(total),
  };
}

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

export const getOrCreateCart = async (userId: string): Promise<CartWithItems> => {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: {
      items: {
        include: {
          productVariant: {
            include: { product: true },
          },
        },
      },
    },
  });

  return enrichCart(cart);
};

export const addItemToCart = async (
  userId: string,
  productVariantId: string,
  quantity: number = 1,
): Promise<CartMutationResult> => {
  // 1. Fetch variant with product (published only)
  const productVariant = await prisma.productVariant.findFirst({
    where: {
      id: productVariantId,
      product: { isPublished: true },
    },
    include: { product: true },
  });

  if (!productVariant) {
    throw new ApiError(404, 'Product not found');
  }

  if (productVariant.stock === 0) {
    throw new ApiError(409, 'This item is out of stock');
  }

  // 2. Get or create the cart (to get cartId and existing item)
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: {
      items: {
        where: { productVariantId },
        take: 1,
        include: {
          productVariant: {
            include: { product: true },
          },
        },
      },
    },
  });

  const existingItem = cart.items[0];
  const currentQuantity = existingItem?.quantity || 0;

  // 3. Compute new quantity capped by stock
  const requestedTotal = currentQuantity + quantity;
  const finalQuantity = Math.min(requestedTotal, productVariant.stock);
  const wasCapped = finalQuantity < requestedTotal;
  const cappedTo = wasCapped ? productVariant.stock : undefined;

  // 4. Upsert cart item with final quantity
  const upserted = await prisma.cartItem.upsert({
    where: {
      cartId_productVariantId: {
        cartId: cart.id,
        productVariantId,
      },
    },
    update: { quantity: finalQuantity },
    create: {
      cartId: cart.id,
      productVariantId,
      quantity: finalQuantity,
    },
    include: {
      productVariant: {
        include: { product: true },
      },
    },
  });

  const cartItemView = enrichCartItem(upserted);
  const freshCart = await getOrCreateCart(userId);

  return {
    cartItem: cartItemView,
    cartTotal: freshCart.total,
    wasCapped,
    cappedTo,
  };
};

export const updateCartItemQuantity = async (
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<CartMutationResult> => {
  // 1. Find the item with ownership check
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      cart: { userId },
    },
    include: {
      productVariant: {
        include: { product: true },
      },
    },
  });

  if (!existingItem) {
    throw new ApiError(404, 'Cart item not found');
  }

  const productVariant = existingItem.productVariant;
  const product = productVariant?.product;
  if (!productVariant || !product || !product.isPublished) {
    throw new ApiError(404, 'Cart item not found');
  }

  // 2. Cap requested quantity to stock
  const finalQuantity = Math.min(quantity, productVariant.stock);
  const wasCapped = finalQuantity < quantity;
  const cappedTo = wasCapped ? productVariant.stock : undefined;

  // 3. Update the item
  const updated = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: finalQuantity },
    include: {
      productVariant: {
        include: { product: true },
      },
    },
  });

  const cartItemView = enrichCartItem(updated);
  const freshCart = await getOrCreateCart(userId);

  return {
    cartItem: cartItemView,
    cartTotal: freshCart.total,
    wasCapped,
    cappedTo,
  };
};

export const removeCartItem = async (
  userId: string,
  cartItemId: string,
): Promise<RemoveCartItemResult> => {
  // 1. Delete with ownership check
  try {
    await prisma.cartItem.delete({
      where: {
        id: cartItemId,
        cart: { userId },
      },
    });
  } catch {
    throw new ApiError(404, 'Cart item not found');
  }

  // 2. Get fresh cart total
  const freshCart = await getOrCreateCart(userId);
  return { cartTotal: freshCart.total };
};

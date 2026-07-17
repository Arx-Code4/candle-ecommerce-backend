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

export const getOrCreateCart = async (userId: string): Promise<CartWithItems> => {
  throw new Error('Not implemented');
};

export const addItemToCart = async (
  userId: string,
  productVariantId: string,
  quantity?: number,
): Promise<CartMutationResult> => {
  throw new Error('Not implemented');
};

export const updateCartItemQuantity = async (
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<CartMutationResult> => {
  throw new Error('Not implemented');
};

export const removeCartItem = async (
  userId: string,
  cartItemId: string,
): Promise<RemoveCartItemResult> => {
  throw new Error('Not implemented');
};

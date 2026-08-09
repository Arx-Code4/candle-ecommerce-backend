import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import * as cartService from '../services/cart.service.js';

export const getCart = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const cart = await cartService.getOrCreateCart(userId);
  res.status(200).json(new SuccessResponse(200, 'OK', cart));
});

export const addCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { productVariantId, quantity } = req.body;
  const result = await cartService.addItemToCart(userId, productVariantId, quantity);

  let message: string;
  if (result.wasCapped) {
    message = `Quantity adjusted to available stock (${result.cappedTo} available)`;
  } else {
    message = 'Item added to cart';
  }

  res.status(201).json(
    new SuccessResponse(201, message, {
      cartItem: result.cartItem,
      cartTotal: result.cartTotal,
      wasCapped: result.wasCapped, // ADD
      cappedTo: result.cappedTo, // ADD
    }),
  );
});

export const updateCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  // Cast params to avoid TypeScript error (Express params can be string | string[])
  const { itemId } = req.params as { itemId: string };
  const { quantity } = req.body;
  const result = await cartService.updateCartItemQuantity(userId, itemId, quantity);

  let message: string;
  if (result.wasCapped) {
    message = `Quantity adjusted to available stock (${result.cappedTo} available)`;
  } else {
    message = 'Cart item updated';
  }

  res.status(200).json(
    new SuccessResponse(201, message, {
      cartItem: result.cartItem,
      cartTotal: result.cartTotal,
      wasCapped: result.wasCapped, // ADD
      cappedTo: result.cappedTo, // ADD
    }),
  );
});

export const removeCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  // Cast params to avoid TypeScript error
  const { itemId } = req.params as { itemId: string };
  const result = await cartService.removeCartItem(userId, itemId);
  res.status(200).json(new SuccessResponse(200, 'Item removed', { cartTotal: result.cartTotal }));
});

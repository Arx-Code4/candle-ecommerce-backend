import { Request, Response, NextFunction } from 'express';
import ApiError from '../../src/utils/ApiError.js';
import asyncHandler from '../../src/utils/asyncHandler.js';
import * as cartService from '../../src/services/cart.service.js';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
} from '../../src/controllers/cart.controller.js';

vi.mock('../../src/services/cart.service.js');

const userId = 'user-1';
const itemId = 'cart-item-1';

const mockReqResNext = (overrides: Partial<Request> = {}) => {
  const req = { user: { id: userId }, params: {}, body: {}, ...overrides } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('cart.controller', () => {
  it('getCart delegates to getOrCreateCart and responds 200', async () => {
    const cart = { items: [], total: '0.00' };
    (cartService.getOrCreateCart as any).mockResolvedValueOnce(cart);
    const { req, res, next } = mockReqResNext();

    await getCart(req, res, next);

    expect(cartService.getOrCreateCart).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('addCartItem responds with the normal message when not capped', async () => {
    (cartService.addItemToCart as any).mockResolvedValueOnce({
      cartItem: { id: itemId, quantity: 2 },
      cartTotal: '20.00',
      wasCapped: false,
    });
    const { req, res, next } = mockReqResNext({
      body: { productVariantId: 'variant-1', quantity: 2 },
    });

    await addCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Item added to cart' }),
    );
  });

  it('addCartItem responds with the capped message when wasCapped is true', async () => {
    (cartService.addItemToCart as any).mockResolvedValueOnce({
      cartItem: { id: itemId, quantity: 5 },
      cartTotal: '50.00',
      wasCapped: true,
      cappedTo: 5,
    });
    const { req, res, next } = mockReqResNext({
      body: { productVariantId: 'variant-1', quantity: 10 },
    });

    await addCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/capped|only|available/i) }),
    );
  });

  it('updateCartItem responds with the capped message the same way as addCartItem', async () => {
    (cartService.updateCartItemQuantity as any).mockResolvedValueOnce({
      cartItem: { id: itemId, quantity: 3 },
      cartTotal: '30.00',
      wasCapped: true,
      cappedTo: 3,
    });
    const { req, res, next } = mockReqResNext({ params: { itemId }, body: { quantity: 7 } });

    await updateCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/capped|only|available/i) }),
    );
  });

  it('updateCartItem uses the normal message when not capped', async () => {
    (cartService.updateCartItemQuantity as any).mockResolvedValueOnce({
      cartItem: { id: itemId, quantity: 4 },
      cartTotal: '40.00',
      wasCapped: false,
    });
    const { req, res, next } = mockReqResNext({ params: { itemId }, body: { quantity: 4 } });

    await updateCartItem(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('removeCartItem delegates correctly and responds 200', async () => {
    (cartService.removeCartItem as any).mockResolvedValueOnce({ cartTotal: '0.00' });
    const { req, res, next } = mockReqResNext({ params: { itemId } });

    await removeCartItem(req, res, next);

    expect(cartService.removeCartItem).toHaveBeenCalledWith(userId, itemId);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Item removed' }));
  });

  it('propagates service errors unchanged through asyncHandler rather than swallowing them', async () => {
    (cartService.removeCartItem as any).mockRejectedValueOnce(
      new ApiError(404, 'Cart item not found'),
    );
    const { req, res, next } = mockReqResNext({ params: { itemId: 'bad-item' } });

    await asyncHandler(removeCartItem)(req, res, next);

    expect(next).toHaveBeenCalledWith(new ApiError(404, 'Cart item not found'));
  });
});

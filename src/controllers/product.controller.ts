import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.service.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';

interface ListProductsQuery {
  scent?: string;
  size?: string;
  page?: number;
  limit?: number;
}

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.getPublishedProducts(
      req.query as unknown as ListProductsQuery,
    );
    res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'OK', result));
  } catch (error) {
    next(error);
  }
}
// Controller error handling — product.controller.test.ts calls getProductById directly (not wrapped by asyncHandler) and asserts it calls next(err) itself, so I gave it an internal try/catch — matching order.controller.ts's pattern rather than admin-product's "let the route's asyncHandler catch it" pattern.
export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await productService.getPublishedProductById(req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'OK', product));
  } catch (error) {
    next(error);
  }
}

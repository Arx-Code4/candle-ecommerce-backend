import { Request, Response, NextFunction } from 'express';
import * as adminProductService from '../services/admin-product.service.js';
import type { ListAllProductsQuery } from '../services/admin-product.service.js';
import { HTTP_STATUS } from '../constants/index.js';
import { SuccessResponse } from '../utils/ApiResponse.js';

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const product = await adminProductService.createProduct(req.body);
  res
    .status(HTTP_STATUS.CREATED)
    .json(new SuccessResponse(HTTP_STATUS.CREATED, 'Product created', product));
};

export const listAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const result = await adminProductService.getAllProducts(
    req.query as unknown as ListAllProductsQuery,
  );
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'OK', result));
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const product = await adminProductService.updateProduct(req.params.id as string, req.body);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Product updated', product));
};

export const updateProductStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const result = await adminProductService.setProductPublishStatus(
    req.params.id as string,
    req.body.isPublished,
  );
  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Product status updated', result));
};

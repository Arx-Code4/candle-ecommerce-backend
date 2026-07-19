import { Request, Response, NextFunction } from 'express';
import * as adminOrderService from '../services/admin-order.service.js';
import type { ListOrdersQuery } from '../services/admin-order.service.js';
import { HTTP_STATUS } from '../constants/index.js';
import { SuccessResponse } from '../utils/ApiResponse.js';

export const listAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const result = await adminOrderService.getAllOrders(req.query as unknown as ListOrdersQuery);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'OK', result));
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const result = await adminOrderService.updateOrderStatus(
    req.params.id as string,
    req.body.status,
  );
  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Order status updated', result));
};

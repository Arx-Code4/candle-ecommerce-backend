import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as orderService from '../services/order.service.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import AppError from '../utils/ApiError.js';

export const listMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await orderService.getOrdersByUser(req.user!.id);
    return res
      .status(HTTP_STATUS.OK)
      .json(new SuccessResponse(HTTP_STATUS.OK, 'Orders retrieved successfully', { items }));
  } catch (error) {
    next(error);
  }
};

export const getMyOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Type assertion to string
    const orderId = req.params.id as string;

    const order = await orderService.getOrderByIdForUser(req.user!.id, orderId);

    if (!order) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Order not found');
    }

    return res
      .status(HTTP_STATUS.OK)
      .json(new SuccessResponse(HTTP_STATUS.OK, 'Order retrieved successfully', order));
  } catch (error) {
    next(error);
  }
};

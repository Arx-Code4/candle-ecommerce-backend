import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as orderService from '../services/order.service.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
// import { validationResult, param } from 'express-validator';
import AppError from '../utils/ApiError.js';

// Validation rules
// export const validateGetOrderById = [
//   param('id').isMongoId().withMessage('Invalid order ID format'),
// ];

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
    // Validate user
    if (!req.user?.id) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'User not authenticated');
    }

    // Type assertion to string
    const orderId = req.params.id as string;

    if (!orderId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Order ID is required');
    }

    const order = await orderService.getOrderByIdForUser(req.user.id, orderId);

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

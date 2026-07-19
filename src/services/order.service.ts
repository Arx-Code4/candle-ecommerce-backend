import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

export interface OrderSummary {
  id: string;
  status: string;
  totalAmount: string;
  itemCount: number;
  createdAt: Date;
}

export interface OrderDetailItem {
  productNameSnapshot: string;
  scentSnapshot: string;
  sizeSnapshot: string;
  unitPriceSnapshot: string;
  quantity: number;
}

export interface OrderDetail {
  id: string;
  status: string;
  totalAmount: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: Date;
  items: OrderDetailItem[];
}

// Helper function to format decimal values with 2 decimal places
const formatDecimal = (value: any): string => {
  // If it's already a string, parse it
  let num: number;
  if (typeof value === 'string') {
    num = parseFloat(value);
  } else if (typeof value === 'number') {
    num = value;
  } else if (value && typeof value.toString === 'function') {
    num = parseFloat(value.toString());
  } else {
    return '0.00';
  }

  if (isNaN(num)) {
    return '0.00';
  }

  return num.toFixed(2);
};

export const getOrdersByUser = async (userId: string): Promise<OrderSummary[]> => {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    itemCount: order._count.items,
    createdAt: order.createdAt,
  }));
};

export const getOrderByIdForUser = async (
  userId: string,
  orderId: string,
): Promise<OrderDetail> => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Order not found');
  }

  return {
    id: order.id,
    status: order.status,
    totalAmount: formatDecimal(order.totalAmount),
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productNameSnapshot: item.productNameSnapshot,
      scentSnapshot: item.scentSnapshot,
      sizeSnapshot: item.sizeSnapshot,
      unitPriceSnapshot: formatDecimal(item.unitPriceSnapshot),
      quantity: item.quantity,
    })),
  };
};

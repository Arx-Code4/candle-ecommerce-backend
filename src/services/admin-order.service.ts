export interface OrderItemDetail {
  id: string;
  variantId: string;
  quantity: number;
}

export interface OrderSummary {
  id: string;
  status: string;
  customerName: string;
  customerEmail: string;
  items: OrderItemDetail[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ListOrdersQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export const getAllOrders = async (
  query: ListOrdersQuery,
): Promise<PaginatedResult<OrderSummary>> => {
  throw new Error('Not implemented');
};

export const updateOrderStatus = async (
  id: string,
  status: string,
): Promise<{ id: string; status: string }> => {
  throw new Error('Not implemented');
};

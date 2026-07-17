// Placeholder — not yet implemented. Full spec in eco-9.1.3.

type OrderSummary = {
  id: string;
  status: string;
  totalAmount: string;
  itemCount: number;
  createdAt: Date;
};

type OrderDetail = {
  id: string;
  status: string;
  totalAmount: string;
  items: Array<{
    nameSnapshot: string;
    scentSnapshot: string;
    sizeSnapshot: string;
    unitPriceSnapshot: string;
    quantity: number;
  }>;
};

export async function getOrdersByUser(userId: string): Promise<OrderSummary[]> {
  throw new Error('Not implemented');
}

export async function getOrderByIdForUser(userId: string, orderId: string): Promise<OrderDetail> {
  throw new Error('Not implemented');
}

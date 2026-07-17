// Placeholder — not yet implemented. Full spec in eco-9.1.3.

type ShippingInput = {
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
};

export async function createChapaSession(
  userId: string,
  shipping: ShippingInput,
): Promise<{ chapaCheckoutUrl: string; txRef: string }> {
  throw new Error('Not implemented');
}

export async function confirmChapaPayment(
  txRef: string,
  chapaStatus: 'success' | 'failed' | 'cancelled',
): Promise<{ orderId?: string; created: boolean }> {
  throw new Error('Not implemented');
}

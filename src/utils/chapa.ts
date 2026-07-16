// Placeholder — not yet implemented. Full spec in eco-9.1.3.

export async function initializeTransaction(input: {
  amount: string;
  email: string;
  txRef: string;
  returnUrl: string;
}): Promise<{ checkoutUrl: string }> {
  throw new Error('Not implemented');
}

export async function verifyTransaction(
  txRef: string,
): Promise<{ status: string; amount: string }> {
  throw new Error('Not implemented');
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  throw new Error('Not implemented');
}

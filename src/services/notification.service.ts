// Placeholder — not yet implemented. Full spec in eco-9.1.3 (order/shipping emails)
// and eco-8.1.2 (password reset email, name assumed — confirm on merge with auth branch).

export async function sendOrderConfirmationEmail(
  order: unknown,
  customerEmail: string,
): Promise<void> {
  throw new Error('Not implemented');
}

export async function sendShippingNotificationEmail(
  order: unknown,
  customerEmail: string,
): Promise<void> {
  throw new Error('Not implemented');
}

export async function sendPasswordResetEmail(...args: unknown[]): Promise<void> {
  throw new Error('Not implemented');
}

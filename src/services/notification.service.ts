// Placeholder — not yet implemented. Full spec in eco-8.1.4 (order/shipping
// emails) and eco-8.1.2 (password reset email, name assumed — confirm this
// against whoever writes the real notification.service.ts, see auth branch
// handoff notes: sendPasswordResetEmail is not documented anywhere yet).

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

// Placeholder — not yet implemented. Full spec/tests land with the Checkout/Order module docs.
// NOTE: sendPasswordResetEmail is an assumed export name (see flag in the auth.service.test.ts
// handoff) — confirm this against whoever writes the real notification.service.ts.

export async function sendOrderConfirmationEmail(...args: unknown[]): Promise<void> {
  throw new Error('Not implemented');
}

export async function sendShippingNotificationEmail(...args: unknown[]): Promise<void> {
  throw new Error('Not implemented');
}

export async function sendPasswordResetEmail(...args: unknown[]): Promise<void> {
  throw new Error('Not implemented');
}

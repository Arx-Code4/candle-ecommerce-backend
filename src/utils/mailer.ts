// Placeholder — not yet implemented. Full spec in eco-9.1.3.

export async function sendMail(message: {
  to: string;
  subject: string;
  html: string;
}): Promise<unknown> {
  throw new Error('Not implemented');
}

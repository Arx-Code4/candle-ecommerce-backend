// Placeholder — not yet implemented. Full spec in eco-8.1.2 / eco-9.1.1.

type AuthResult = {
  user: { id: string; name: string; email: string; role: string };
  token: string;
  cartItemAdded: boolean;
};

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<AuthResult> {
  throw new Error('Not implemented');
}

export async function loginUser(input: {
  email: string;
  password: string;
  pendingVariantId?: string;
}): Promise<AuthResult> {
  throw new Error('Not implemented');
}

export async function getUserById(
  id: string,
): Promise<{ id: string; name: string; email: string; role: string }> {
  throw new Error('Not implemented');
}

export async function requestPasswordReset(email: string): Promise<void> {
  throw new Error('Not implemented');
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  throw new Error('Not implemented');
}

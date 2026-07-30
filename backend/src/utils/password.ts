import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash a plaintext password with bcrypt (D-3). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Constant-time compare of a plaintext password against a stored hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

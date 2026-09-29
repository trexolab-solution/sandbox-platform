import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * Compatible with Better-auth custom password configuration
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return await bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash using bcrypt
 * Compatible with Better-auth custom password configuration
 */
export async function verifyPassword(data: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return await bcrypt.compare(data.password, data.hash);
}

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

/** Salted scrypt hash, formatted as `salt:hash` (both hex) so a single string is easy to persist. */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time comparison — never use `===` on secrets, it leaks timing information. */
export function verifySecret(secret: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }
  const candidate = scryptSync(secret, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** A URL-safe random token — used for both API keys and secrets. */
export function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

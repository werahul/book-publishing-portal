import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: string | undefined;

/**
 * Compare against a throwaway hash when the email doesn't exist, so the
 * response time doesn't reveal which emails are registered.
 */
export async function burnPasswordCheck(plain: string): Promise<false> {
  dummyHash ??= await bcrypt.hash('bookleaf-timing-equaliser', BCRYPT_ROUNDS);
  await bcrypt.compare(plain, dummyHash);
  return false;
}

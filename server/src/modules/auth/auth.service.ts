import { Errors } from '../../lib/app-error';
import { signSessionToken } from '../../lib/jwt';
import { burnPasswordCheck, verifyPassword } from '../../lib/password';
import type { AuthUser } from '../../types/auth';
import { User } from '../users/user.model';
import { toAuthUser } from '../users/user.dto';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

/**
 * Unknown email and wrong password produce the same error and take roughly
 * the same time, so the endpoint can't be used to discover registered emails.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await User.findOne({ email }).select('+passwordHash').lean();

  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await burnPasswordCheck(password);

  if (!user || !passwordOk) throw Errors.invalidCredentials();

  const token = signSessionToken({ userId: String(user._id), role: user.role });
  return { token, user: toAuthUser(user) };
}

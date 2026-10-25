import type { Role } from '@bookleaf/shared';
import { env } from '../../config/env';
import { Errors } from '../../lib/app-error';
import { signSessionToken, signSocketToken, SOCKET_TOKEN_TTL_SECONDS } from '../../lib/jwt';
import { burnPasswordCheck, verifyPassword } from '../../lib/password';
import type { AuthUser } from '../../types/auth';
import { User } from '../users/user.model';
import { toAuthUser } from '../users/user.dto';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

const WRONG_PORTAL_MESSAGES: Record<Role, string> = {
  admin: 'This is a BookLeaf team account. Switch to the BookLeaf Team sign-in.',
  author: 'This is an author account. Switch to the Author sign-in.',
};

/**
 * Unknown email and wrong password produce the same error and take roughly
 * the same time, so the endpoint can't be used to discover registered emails.
 *
 * `portal` is the sign-in tab the user chose. A mismatch is only reported after
 * the password checks out, so it reveals nothing to someone without the password.
 */
export async function login(email: string, password: string, portal?: Role): Promise<LoginResult> {
  const user = await User.findOne({ email }).select('+passwordHash').lean();

  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await burnPasswordCheck(password);

  if (!user || !passwordOk) throw Errors.invalidCredentials();
  if (portal && portal !== user.role) throw Errors.wrongPortal(WRONG_PORTAL_MESSAGES[user.role]);

  const token = signSessionToken({ userId: String(user._id), role: user.role });
  return { token, user: toAuthUser(user) };
}

export interface SocketTokenDto {
  token: string;
  /** Where to open the Socket.IO connection (the Next.js rewrite can't proxy WebSockets). */
  url: string;
  expiresIn: number;
}

export function issueSocketToken(user: AuthUser): SocketTokenDto {
  return {
    token: signSocketToken({ userId: user.id, role: user.role }),
    url: env.SOCKET_PUBLIC_URL,
    expiresIn: SOCKET_TOKEN_TTL_SECONDS,
  };
}

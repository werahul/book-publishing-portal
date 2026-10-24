import type { AuthUser } from '../../types/auth';
import type { UserRecord } from './user.model';

type UserLike = Pick<UserRecord, '_id' | 'email' | 'name' | 'role' | 'authorProfile'>;

/** Whitelisted public shape of a user — never includes the password hash. */
export function toAuthUser(user: UserLike): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.authorProfile && {
      authorProfile: {
        externalId: user.authorProfile.externalId,
        phone: user.authorProfile.phone ?? null,
        city: user.authorProfile.city ?? null,
        joinedDate: user.authorProfile.joinedDate ?? null,
      },
    }),
  };
}

import type { Role } from '@bookleaf/shared';

export interface AuthorProfileDto {
  externalId: string;
  phone: string | null;
  city: string | null;
  joinedDate: Date | null;
}

/** The authenticated user as attached to `req.user` and returned by /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorProfile?: AuthorProfileDto;
}

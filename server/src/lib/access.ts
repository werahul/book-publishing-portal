import type { AuthUser } from '../types/auth';

/**
 * Ownership filter for author-owned collections (books, tickets).
 * Services MUST merge this into every query that takes a user, so an author
 * can only ever see their own documents. Admins get no restriction.
 */
export function scopeByOwner(user: AuthUser): { author?: string } {
  return user.role === 'admin' ? {} : { author: user.id };
}

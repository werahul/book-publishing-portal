import type { RequestHandler } from 'express';
import { SESSION_COOKIE_NAME, type Role } from '@bookleaf/shared';
import { Errors } from '../lib/app-error';
import { verifySessionToken } from '../lib/jwt';
import { User } from '../modules/users/user.model';
import { toAuthUser } from '../modules/users/user.dto';

/**
 * Verifies the session cookie and attaches the user to `req.user`.
 * The user is re-loaded from the database on every request, so deleting a user
 * (or changing their role) takes effect immediately without waiting for the JWT to expire.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) throw Errors.unauthenticated();

  const { userId } = verifySessionToken(token);
  const user = await User.findById(userId).lean();
  if (!user) throw Errors.unauthenticated('Your session is no longer valid. Please log in again.');

  req.user = toAuthUser(user);
  next();
};

/** Must run after `requireAuth`. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw Errors.unauthenticated();
    if (!roles.includes(req.user.role)) throw Errors.forbidden();
    next();
  };

/** Narrow `req.user` inside controllers that sit behind `requireAuth`. */
export function currentUser(req: Express.Request) {
  if (!req.user) throw Errors.unauthenticated();
  return req.user;
}

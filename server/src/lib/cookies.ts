import type { CookieOptions, Response } from 'express';
import { SESSION_COOKIE_NAME } from '@bookleaf/shared';
import { env, isProduction } from '../config/env';

// SameSite=Lax is enough because the browser reaches the API through the
// Next.js rewrite, so the cookie is first-party (see docs/02-architecture.md §3.1).
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions, maxAge: env.JWT_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions);
}

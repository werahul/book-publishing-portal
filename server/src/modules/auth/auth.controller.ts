import type { Request, Response } from 'express';
import type { LoginInput } from '@bookleaf/shared';
import { clearSessionCookie, setSessionCookie } from '../../lib/cookies';
import { currentUser } from '../../middleware/auth';
import * as authService from './auth.service';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const { token, user } = await authService.login(email, password);
  setSessionCookie(res, token);
  res.json({ data: { user } });
}

/** Idempotent: clearing a cookie that isn't there is fine. */
export function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  res.status(204).end();
}

export function me(req: Request, res: Response) {
  res.json({ data: { user: currentUser(req) } });
}

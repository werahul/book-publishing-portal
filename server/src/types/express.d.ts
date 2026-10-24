import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. */
      user?: AuthUser;
    }
  }
}

export {};

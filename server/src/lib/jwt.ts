import jwt from 'jsonwebtoken';
import { ROLES, type Role } from '@bookleaf/shared';
import { env } from '../config/env';
import { Errors } from './app-error';

// iss/aud are checked on verify, so a token minted for another purpose
// (e.g. the short-lived socket token in a later phase) can't be used as a session.
export const JWT_ISSUER = 'bookleaf-api';
export const SESSION_AUDIENCE = 'bookleaf-web';

export interface SessionClaims {
  userId: string;
  role: Role;
}

export function signSessionToken({ userId, role }: SessionClaims): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: JWT_ISSUER,
    audience: SESSION_AUDIENCE,
    expiresIn: env.JWT_TTL_SECONDS,
  });
}

/** Throws a 401 AppError for any invalid, expired or tampered token. */
export function verifySessionToken(token: string): SessionClaims {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !ROLES.includes(payload.role as Role)
    ) {
      throw new Error('Malformed session payload');
    }
    return { userId: payload.sub, role: payload.role as Role };
  } catch {
    throw Errors.unauthenticated('Your session is invalid or has expired. Please log in again.');
  }
}

// ── Socket handshake token ───────────────────────────────────────────────────
// The session cookie is httpOnly and scoped to the web origin, so the browser can't
// hand it to the Socket.IO server directly. Instead it trades the session for a
// short-lived token with its own audience (GET /auth/socket-token).
export const SOCKET_AUDIENCE = 'bookleaf-socket';
export const SOCKET_TOKEN_TTL_SECONDS = 60;

export function signSocketToken({ userId, role }: SessionClaims): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: JWT_ISSUER,
    audience: SOCKET_AUDIENCE,
    expiresIn: SOCKET_TOKEN_TTL_SECONDS,
  });
}

/** Throws for anything that isn't a valid, unexpired socket token (session tokens included). */
export function verifySocketToken(token: string): SessionClaims {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: SOCKET_AUDIENCE,
  });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ROLES.includes(payload.role as Role)) {
    throw new Error('Malformed socket token');
  }
  return { userId: payload.sub, role: payload.role as Role };
}

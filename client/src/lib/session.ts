import { jwtVerify } from "jose";
import { ROLES, type Role } from "@bookleaf/shared";

// Must match server/src/lib/jwt.ts.
const ISSUER = "bookleaf-api";
const AUDIENCE = "bookleaf-web";

export interface Session {
  userId: string;
  role: Role;
}

/**
 * Verifies the session cookie for routing decisions only.
 * The API re-checks every request against the database; this never grants data access.
 */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    const role = payload.role as Role;
    if (typeof payload.sub !== "string" || !ROLES.includes(role)) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

---
name: auth-rbac
description: How authentication and role-based access work in BookLeaf (JWT httpOnly cookie, Next.js rewrite proxy, requireAuth/requireRole, owner scoping, the 404-vs-403 policy). Use when touching login/logout, sessions, permissions, the client route guard (src/proxy.ts), or writing permission tests.
---

# Auth & RBAC

## The flow
1. `POST /api/v1/auth/login` (`server/src/modules/auth/`):
   - Validates with `loginSchema` and looks the user up with `.select('+passwordHash')`.
   - Compares with bcrypt. An unknown email runs `burnPasswordCheck` so both failures take about the same time and return the same `401 INVALID_CREDENTIALS`.
   - Optional `portal` (`author` | `admin`) is the sign-in tab the user chose (`/login` vs `/login?as=team`). A mismatch returns `403 WRONG_PORTAL` with no cookie, but **only after** the password check, so it never reveals which emails are admins. Both tabs share one JWT and cookie; never split them per role.
   - Signs a JWT (`src/lib/jwt.ts`): HS256, `sub` = user id, `role`, `iss: bookleaf-api`, `aud: bookleaf-web`, TTL `JWT_TTL_SECONDS`.
   - Sets the `bl_token` cookie (`src/lib/cookies.ts`): httpOnly, SameSite=Lax, Path=/, Secure in production.
2. The browser only talks to the Next.js origin. `client/next.config.ts` rewrites `/api/*` to Express, so the cookie is first-party. Never switch to `SameSite=None` or cross-origin fetches.
3. `requireAuth` (`server/src/middleware/auth.ts`) verifies the cookie, **re-loads the user from MongoDB** (so deleted users are locked out immediately) and sets `req.user: AuthUser`.
4. `requireRole('admin')` returns 403 `FORBIDDEN` for any other role.
5. Services apply `scopeByOwner(user)`. Authors get `{ author: user.id }`, admins get `{}`.
6. Client `src/proxy.ts` verifies the same JWT with `jose` (it needs `JWT_SECRET` in `client/.env.local`) and redirects by role. **It's UX only and must never be the only check.**
7. If the API returns 401 to `serverFetch`, the user goes to `/login?reauth=1` and the proxy deletes the stale cookie. This prevents a redirect loop when a token verifies but the user no longer exists.

## Rules
- Another author's resource → **404 `NOT_FOUND`** (don't confirm it exists). Wrong role on an admin endpoint → **403**.
- `passwordHash` is `select: false`. Only `auth.service.ts` selects it, and DTOs (`toAuthUser`) whitelist fields.
- Spread `scopeByOwner(user)` last so query parameters can't widen the scope (there's a test for `?authorId=` on `/books`).
- Internal notes live in a separate collection (`internalnotes`). Author code paths never query it.
- Socket auth (Phase 4) uses a separate short-lived token with a different `aud`. Session tokens must not be accepted there, and socket tokens must not be accepted as sessions.

## Permission test matrix (`server/tests/rbac.test.ts`, `auth.test.ts`)
For every new protected resource, add rows for:

| Actor | Own resource | Other author's resource | Admin-only route |
|---|---|---|---|
| No cookie | 401 | 401 | 401 |
| Author | 200 | **404** | **403** |
| Admin | 200 | 200 | 200 |

Plus: tampered or expired token → 401, deleted user → 401, and author payloads don't contain admin-only fields.

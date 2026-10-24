---
name: add-api-endpoint
description: Checklist for adding or changing a REST endpoint in the BookLeaf Express API (server/). Use when creating routes, controllers, services or request schemas, e.g. ticket, message, note or AI-draft endpoints.
---

# Add an API endpoint

Follow these steps in order. `server/src/modules/books/` is the reference implementation.

## 1. Request schema → `packages/shared/src/schemas/<feature>.ts`
- Zod schemas for `body`, `query` and `params`. Export the inferred types (`export type X = z.infer<typeof xSchema>`).
- Use `objectIdSchema` from `schemas/common.ts` for ids, and the enums from `constants.ts` (`z.enum(TICKET_STATUSES)`).
- Trim strings and set min/max lengths that match the Mongoose model.
- Re-export from `src/index.ts`, then run `npm run build:shared`. The server and client read `dist/`.

## 2. Service → `server/src/modules/<feature>/<feature>.service.ts`
- Signature: `(user: AuthUser, input) => Promise<Dto>`.
- **Ownership:** merge `...scopeByOwner(user)` (`src/lib/access.ts`) as the **last** spread in every filter, so it can't be overridden by user input.
- Missing resource, or one owned by another author: `throw Errors.notFound('Ticket')` (404, never 403).
- Wrong state or business rule: an `AppError` with a specific `code` (add a factory to `Errors` if it will be reused).
- Use `.lean<Record>()` for reads and map through a whitelisting DTO function in `<feature>.dto.ts`.
- Author-facing DTOs must never include `ai`, `priority*`, `*Source`, `assignee` or internal notes.

## 3. Controller → `<feature>.controller.ts`
- HTTP only: read `req.body`/`req.query`/`req.params` (already validated), call the service, `res.json({ data, meta? })`, `res.status(201)` for creates, `204` for no content.
- Use `currentUser(req)` from `middleware/auth.ts`. No Mongoose imports. No try/catch (Express 5 forwards rejections to `errorHandler`).

## 4. Route → `<feature>.routes.ts`, mounted in `src/routes.ts`
```ts
router.use(requireAuth);                               // all routes in the module
router.patch('/:id', requireRole('admin'), validate({ params, body }), controller.update);
```
- The order is always: rate limit (if any) → `requireAuth` → `requireRole` → `validate` → controller.
- Use plural, kebab-case resource paths. Sub-resources look like `/tickets/:id/messages`.

## 5. Tests → `server/tests/<feature>.test.ts`
Use `startTestDb`, `seedSample` and `loginAs` from `tests/helpers.ts`. At minimum cover:
- 401 without a session
- 403 for the wrong role (if the route is admin-only)
- 404 when an author touches another author's resource
- 400 `VALIDATION_ERROR` with the expected `details[].path` (e.g. `body.subject`)
- the happy path and its response shape, including that admin-only fields are **absent** for authors

Run `npm test`, then `npm run typecheck`.

## 6. Docs → `docs/04-api.md`
Add a section with: method + path, access, query/body rules table, a sample response, and the error codes. Move the endpoint out of the "Planned endpoints" table if it was listed there.

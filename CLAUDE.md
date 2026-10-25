# BookLeaf Author Support Portal

Take-home assignment for BookLeaf Publishing: an author portal, an admin support console and an AI assistant (classify, prioritise, draft replies). The brief is in `assignment_doc/`; the requirements, written up with IDs, are in `docs/01-requirements.md`.

**Grading weights:** AI integration 25% · architecture/code 25% · API design 15% · functionality 15% · product thinking 10% · docs 10%.

## Layout

npm workspaces monorepo:

| Path | What |
|---|---|
| `packages/shared` | `@bookleaf/shared`: enums (`constants.ts`) and Zod request schemas (`schemas/`). Compiled to CJS in `dist/` by the root `postinstall`. **Rebuild after editing:** `npm run build:shared` |
| `server/` | Express 5 + Mongoose 8 API, TypeScript (CJS). Feature modules in `src/modules/<feature>/` |
| `client/` | Next.js 16 App Router + Tailwind v4. `src/proxy.ts` is the route guard (Next 16 renamed middleware → proxy) |
| `docs/` | 01 requirements · 02 architecture · 03 data model · 04 API · 05 seed · 06 roadmap |

## Commands (run from the repo root)

```bash
npm install                 # also builds @bookleaf/shared
npm run seed                # idempotent upsert of the sample data (needs server/.env)
npm run seed -- --reset     # wipe + seed
npm run dev:server          # API on :4000  (tsx watch)
npm run dev:client          # web on :3000
npm test                    # server Jest + Supertest (in-memory MongoDB, no .env needed)
npm run typecheck           # all workspaces
npm run lint -w client
```

Env: copy `server/.env.example` → `server/.env` and `client/.env.example` → `client/.env.local`. **`JWT_SECRET` must be identical in both files.**

## Conventions (follow these)

- **Module layering:** `*.routes.ts` (paths + middleware chain) → `*.controller.ts` (HTTP only, no Mongoose) → `*.service.ts` (business logic, RBAC scoping, throws `Errors.*`) → `*.model.ts`. Serialise with whitelisting DTO functions (`*.dto.ts`); never return raw documents.
- **Envelope:** success is `{ data, meta? }`; errors are `{ error: { code, message, details? } }`. Throw `Errors.*` from `server/src/lib/app-error.ts`. Never `res.status(500)` by hand: `middleware/error-handler.ts` owns that.
- **Validation:** Zod schemas live in `@bookleaf/shared` and are applied with `validate({ body, query, params })`. The client reuses the same schema for forms.
- **Auth/RBAC:**
  - `requireAuth` then `requireRole('admin')` for admin routes.
  - Author-owned queries **must** spread `scopeByOwner(user)` (`server/src/lib/access.ts`) last.
  - Another author's resource → **404**, not 403.
  - Internal notes live in their own collection and never go into author-facing payloads.
- **Secrets:** server-side env only. Never use `NEXT_PUBLIC_` for secrets or the API URL. The browser calls same-origin `/api/v1/*` (Next rewrite).
- **Next.js 16:**
  - `cacheComponents` is on, so server components that call `cookies()` or fetch must be wrapped in `<Suspense>`.
  - Use `serverFetch` (`client/src/lib/server-api.ts`) in RSC and `apiFetch` (`client/src/lib/api.ts`) in client components.
  - Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see `client/AGENTS.md`).
- **Every new endpoint:** add a test in `server/tests/` and a section in `docs/04-api.md`.
- **Tickets:** `server/src/modules/tickets/ticket.service.ts` owns status transitions and triage. New tickets are classified instantly by `modules/ai/fallback-classifier.ts`, then by the LLM in a background job (`ticket-ai.service.ts`, via `lib/background.ts`). Author payloads go through `toAuthorTicketDto`; never add admin fields there.
- **AI + real-time:**
  - Prompts live in `modules/ai/` and never touch the DB.
  - In tests, install `FakeAiProvider` (`tests/fake-ai.ts`) via `setAiProvider()`, and `await settleBackgroundJobs()` before asserting on AI results.
  - Mutations call `emitTicketEvent()` (`src/realtime/realtime.ts`). Payloads are `{ ticketId, ticketNumber }` only; never put ticket data on the socket.
- **Client mutations:** call `apiFetch`, then `router.refresh()` inside `startTransition`. Filters live in URL search params.
- **Dev processes on Windows:** stopping a background `npm run dev` can leave the child `node` process holding :3000/:4000. Check the port's owner before starting another.
- **Commits:** the user makes commits themselves. Don't commit unless asked.

## Project skills

`.claude/skills/`:
- `add-api-endpoint`: the end-to-end checklist for a new route
- `auth-rbac`: the session/cookie flow and the permission test matrix
- `seed-data`: running or extending the seed
- `ai-prompting`: rules for the Groq integration (Phase 3)

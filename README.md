# BookLeaf Author Support Portal

An author-support portal for BookLeaf Publishing. Authors see their books and royalties and raise tickets. The ops team works a prioritised queue, and an AI assistant triages every ticket and drafts replies grounded in the BookLeaf knowledge base. An admin always reviews a draft before it is sent.

**Live demo:** _(add the Vercel URL here)_. The API runs on Render's free plan, so the first request after a quiet spell can take about 50 s while it wakes.

## Test credentials

All accounts are seeded from `FULLSTACK-SAMPLEDATA.json` (10 authors, 18 books), plus two admins and ten demo tickets. The sign-in page has an **Author / BookLeaf Team** toggle, each with its own look and one-click demo accounts. Admins can go straight to `/login?as=team`. Both tabs share one login endpoint and one JWT session; the tab only checks that the account matches it.

| Role | Email | Password | Good for |
|---|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` | Support lead: queue, AI drafts, overrides |
| Admin | `support@bookleaf.com` | `Admin@123` | Second agent: assignment and live updates across two windows |
| Author | `priya.sharma@email.com` | `Author@123` | Two live books, one fully paid |
| Author | `sneha.kulkarni@email.com` | `Author@123` | Three books, one in production (Cover Design) |
| Author | `kavita.deshmukh@email.com` | `Author@123` | One book in Typesetting; one live with ₹850 pending (below the ₹1,000 payout threshold) |
| Author | `ananya.reddy@email.com` | `Author@123` | Live book, never paid |
| Author | `diya.chatterjee@email.com` | `Author@123` | No tickets yet (empty states) |

Every other author in the dataset uses their dataset email and `Author@123`.

**A five-minute tour** (a step-by-step guide with every URL is in [`docs/07-user-guide.md`](docs/07-user-guide.md)):
1. Open two windows: an author in one, `admin@bookleaf.com` in the other.
2. As the author, raise a ticket.
3. It appears in the admin queue without a refresh. The keyword triage shows first, and within a second or two the AI category and priority replace it.
4. Open the ticket as the admin. An AI draft is waiting, written from the author's real royalty figures and BookLeaf's policies. Edit it and send.
5. The reply appears on the author's ticket live.
6. Add an internal note. It never reaches the author.

## What's built, against the brief

| Brief | Where |
|---|---|
| **A. Author portal**: login; My Books with every requested field; ticket form with book dropdown + "General / Account Level", subject, description and attachment UI; My Tickets with status and replies, updating live | `client/src/app/author/` |
| Edge cases: books in production show their stage and "—" instead of ₹0; zero, never-paid and below-threshold royalties are explained in plain words | `client/src/lib/royalty.ts`, `packages/shared/src/royalty.ts` |
| **B. Admin portal**: queue across all authors, filterable by status, category, priority, assignee, author, date and text; urgency sort (priority, then age) with stale and awaiting-reply flags | `client/src/app/admin/tickets/` |
| AI classification and priority, each overridable. The source of each value (`ai` / `admin` / `fallback`) is shown and recorded | `server/src/modules/ai/classify.ts` |
| AI-drafted reply → edit → send → visible to the author; regenerate on demand; manual reply always available | `server/src/modules/ai/draft.ts`, `reply-composer.tsx` |
| Status changes, internal notes, assign to yourself or a teammate, author context (books, royalties) beside the ticket | `server/src/modules/tickets/` |
| **C. API**: REST under `/api/v1`, auth on every non-public route, RBAC, Zod validation with field-level errors, one error envelope, full docs | [`docs/04-api.md`](docs/04-api.md) |
| **D. AI**: see [AI integration](#ai-integration) below | `server/src/modules/ai/` |

## Running locally

Requires Node ≥ 20.19 and a MongoDB URI (Atlas free tier or local). A Groq key is optional: without it, the app runs on keyword triage and manual replies.

```bash
npm install                                   # also builds the shared package
cp server/.env.example server/.env            # fill MONGODB_URI, JWT_SECRET, GROQ_API_KEY
cp client/.env.example client/.env.local      # JWT_SECRET must equal the server's
npm run seed -- --reset                       # 10 authors, 18 books, 2 admins, 10 demo tickets
npm run dev:server                            # API  → http://localhost:4000/api/v1
npm run dev:client                            # web  → http://localhost:3000
```

Checks: `npm test` (no `.env` or database needed; it uses in-memory MongoDB), `npm run typecheck`, `npm run lint -w client`.

## Architecture

```
client/  Next.js 16 (App Router, server components)  ──/api/* rewrite──▶  server/  Express 5 + Socket.IO  ──▶  MongoDB Atlas
                    ▲                                                               │
                    └────────── Socket.IO: { ticketId } invalidation events ────────┘──▶  Groq (LLM)
packages/shared/  enums + Zod request schemas used by both sides
```

Key decisions (details in [`docs/02-architecture.md`](docs/02-architecture.md)):

- **The browser only talks to the Next.js origin.** `/api/*` is rewritten to Express, so the JWT lives in a first-party, httpOnly, `SameSite=Lax` cookie. There's no CORS, no third-party-cookie problems, and the API URL never ships in the bundle.
- **Separate Express API instead of Next route handlers.** It's a long-running process, so Socket.IO and background AI jobs work. Serverless functions can't hold sockets.
- **Feature modules with strict layering:** `routes → controller (HTTP only) → service (business rules, RBAC scoping) → model`. Responses go through whitelisting DTOs. The author-facing ticket DTO cannot carry admin fields, and internal notes live in their own collection, so a forgotten filter can't leak them.
- **RBAC in the service layer.** Author queries are always scoped to their owner. Another author's ticket or book returns **404, not 403**, so its existence isn't revealed.
- **One Zod schema per request,** shared by server validation and client forms.
- **Real-time events carry no data.** The socket only says "ticket X changed". The page re-fetches through the REST API, so access control lives in one place and nothing admin-only can leak over the socket. If the socket can't connect, the page polls every 15 s.
- **MongoDB.** A book with nested royalty figures and a ticket with AI metadata are naturally documents. Indexes match the queue's filters and urgency sort. Schema: [`docs/03-data-model.md`](docs/03-data-model.md).

## AI integration

Provider: **Groq**. `openai/gpt-oss-20b` classifies; `openai/gpt-oss-120b` drafts. Both can be changed through env vars, and the vendor sits behind an `AiProvider` interface, so OpenAI or Anthropic is a one-file change.

### Prompt strategy
- **The knowledge base is split into sections** (`knowledge-base.ts`, transcribed verbatim from the brief). A draft prompt carries only the section(s) for the ticket's category, plus the tone guide and the closest sample Q→A from the brief to calibrate voice.
- **Facts, not arithmetic.** The draft gets a `<facts>` sheet for the selected book only: copies sold, earned / paid / pending, last payout, and production stage. It also gets the next payout date and whether a payout was actually missed, computed in code (quarter end + 45 days, the ₹1,000 threshold), so the model quotes dates instead of inventing them.
- **Hard rules in the system prompt:**
  - Acknowledge the concern first.
  - Use real numbers.
  - Own BookLeaf's mistakes.
  - Promise only timelines the KB states (48 h, 5–7 days, 24–48 h).
  - Never speculate about causes.
  - End with a clear next step.
  - No placeholders or "as an AI" language.
- **Classification** uses a rubric with the brief's own example: "no royalty for months" ranks above "update my bio". It returns JSON, which is validated with Zod. A **policy floor** in code keeps ISBN errors at High or above whatever the model says, because the KB commits to that.
- **Prompt-injection guard.** Author text is fenced in `<ticket>`, tag look-alikes inside it are neutralised, and both prompts say to treat it as data. A test ticket that tries to raise its own priority is classified as general/low.

### Graceful degradation
- **Ticket creation never waits on the LLM.** A keyword classifier triages instantly (`source: fallback`), the ticket is saved and returned, and the LLM refines it in a background job.
- **When the model fails**, whether by timeout (15 s, one retry), rate limit, 5xx, bad JSON (after one repair turn) or a missing key, the keyword triage stays, the ticket is flagged `ai.state = failed`, and the admin can re-run classification.
- **When drafting fails,** the API returns `503 AI_UNAVAILABLE` with a clear message. The admin sees an empty editor and writes the reply by hand.
- **Admin overrides always win,** even when made while the model is still thinking (the write is conditional on the source).

### Cost management
- **Small model for every ticket, large model only for drafts.**
- **Drafts are generated on demand,** when an admin opens a ticket that needs a reply. They are cached on the ticket, regenerated only on request or after new activity, and concurrent opens share one call.
- **Context is capped:** only the relevant KB sections, one book's facts, and the last 3 messages truncated to 600 chars each. The full KB and full history are never sent.
- **Low reasoning effort and tight token caps:** 200 tokens to classify, 800 to draft.
- **Token usage is logged on every call.** Measured on the seed data: about 600 prompt tokens per classification and about 850 per draft, with 0.2–1.1 s latency.

Why Groq: its latency keeps the draft ready by the time an admin reads the ticket, its free tier fits a demo, and it offers JSON mode. The trade-off and the measurements are in [`docs/02-architecture.md` §4.2](docs/02-architecture.md#42-model-choice).

API keys are only in server env vars and never reach the client. The only `NEXT_PUBLIC_` variable is the demo-login toggle.

## API

Base `/api/v1`. Success is `{ data, meta? }`; errors are `{ error: { code, message, details? } }`. Full reference with examples, error codes and the socket protocol: **[`docs/04-api.md`](docs/04-api.md)**.

| Method | Path | Who |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/login`, `/auth/logout` | public (login is rate-limited) |
| GET | `/auth/me`, `/auth/socket-token` | signed in |
| GET | `/books`, `/books/:id` | author (own) / admin (all) |
| GET | `/authors`, `/admins` | admin |
| GET / POST | `/tickets` | list: both roles (scoped) · create: author |
| GET | `/tickets/stats` | admin |
| GET / PATCH | `/tickets/:id` | read: both (scoped) · update status/category/priority/assignee: admin |
| POST | `/tickets/:id/messages` | both (authors on their own tickets) |
| POST | `/tickets/:id/notes` | admin |
| GET / POST | `/tickets/:id/ai-draft` | admin (get cached / regenerate) |
| POST | `/tickets/:id/classify` | admin (re-run AI triage) |

## Tests

Jest, Supertest and an in-memory MongoDB, with a fake AI provider. The suites cover:
- the RBAC matrix (401 / 403 / 404-not-403) for every resource
- the ticket lifecycle and status transitions
- internal-note isolation over REST and over the socket
- queue filters, sorting and pagination
- AI success, timeout, rate limit, bad JSON and bad enums, each falling back correctly
- draft caching, coalescing and the stale-write guard
- the prompt builders
- Groq error mapping
- socket handshake auth and room delivery
- the seed against the exact sample dataset
- the royalty payout-window maths

## Known limitations and what I'd do next

- **Attachments are metadata only.** The brief makes real upload a bonus. Next step: S3 with pre-signed URLs and type and size checks.
- **Single API instance.** Background AI jobs and draft coalescing are in-process. To scale out, move them to a queue (BullMQ on Redis) and add the Socket.IO Redis adapter.
- **No email notifications or password reset.** Accounts are seeded, and live in-app updates cover the brief.
- **The royalty per-platform breakdown** mentioned in the KB isn't in the dataset, so it isn't shown.
- **AI quality is checked by hand** on the brief's sample queries. Next step: an eval set run in CI, and tracking how much admins edit each draft as a quality signal.
- **The free Render plan has cold starts.**

## Docs

| Doc | What |
|---|---|
| [`WRITEUP.md`](WRITEUP.md) | One-page summary: priorities, trade-offs, path to production |
| [`docs/01-requirements.md`](docs/01-requirements.md) | The brief as numbered requirements, edge cases, assumptions |
| [`docs/02-architecture.md`](docs/02-architecture.md) | System design, auth, real-time, AI pipeline, deployment |
| [`docs/03-data-model.md`](docs/03-data-model.md) | Collections, indexes, why |
| [`docs/04-api.md`](docs/04-api.md) | Every endpoint |
| [`docs/05-seed-data.md`](docs/05-seed-data.md) | Seed pipeline, demo tickets, data edge cases |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Build phases |
| [`docs/07-user-guide.md`](docs/07-user-guide.md) | Plain-English user flow, every page URL, and a manual test checklist |

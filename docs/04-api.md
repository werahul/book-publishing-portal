# 04 — REST API

Base URL: `/api/v1`. In the browser this is same-origin through the Next.js rewrite. Locally the API runs at `http://localhost:4000/api/v1`.

## Conventions

| Topic | Convention |
|---|---|
| Resources | Plural nouns, kebab-case: `/books`, `/tickets/:id/messages`, `/tickets/:id/notes` |
| IDs | Mongo ObjectIds. Book routes also accept the dataset ID (`BK001`). |
| Auth | `bl_token` httpOnly cookie, set by `POST /auth/login`. Every route except `/health`, `/auth/login` and `/auth/logout` needs it. |
| Content type | `application/json` (bodies capped at 100 kb) |
| Success | `2xx` with `{ "data": ... }` (plus `"meta"` for paginated lists). `204` has no body. |
| Errors | `{ "error": { "code": "MACHINE_CODE", "message": "Human readable", "details"?: [...] } }` |
| Dates | ISO-8601 strings (UTC) |
| Money | Whole INR numbers. `null` when not applicable (e.g. MRP of a book in production). |

### Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query or params failed Zod validation. `details` = `[{ path, message }]` |
| 400 | `INVALID_ID` | Malformed ObjectId |
| 400 | `INVALID_JSON` | Request body isn't valid JSON |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 kb |
| 401 | `UNAUTHENTICATED` | No cookie, or an invalid, expired or tampered token, or the user no longer exists |
| 401 | `INVALID_CREDENTIALS` | Wrong email **or** password (deliberately the same response for both) |
| 403 | `FORBIDDEN` | Authenticated but the wrong role |
| 403 | `WRONG_PORTAL` | Login with correct credentials on the other sign-in tab (`portal` doesn't match the account's role). No cookie is set |
| 404 | `NOT_FOUND` | Missing resource, **or one owned by another author** |
| 404 | `ROUTE_NOT_FOUND` | Unknown endpoint |
| 409 | `CONFLICT` | Unique constraint violated |
| 409 | `TICKET_CLOSED` | Reply attempted on a closed ticket |
| 429 | `RATE_LIMITED` | Too many login attempts (10 per 15 min per IP) |
| 500 | `INTERNAL_ERROR` | Unexpected. Details are logged server-side, never returned. |
| 409 | `TICKET_CLOSED` | Also: AI draft requested for a closed ticket |
| 503 | `SERVICE_UNAVAILABLE` | `GET /health` only: the API can't reach MongoDB |
| 503 | `AI_UNAVAILABLE` | The LLM is down, rate-limited, timed out, returned unusable output, or no key is configured. Only the AI endpoints (`/ai-draft`, `/classify`) return it; everything else degrades silently |

---

## Health

### `GET /health` — public
`200 { "data": { "status": "ok", "db": "up", "uptime": 12.34 } }`

Returns `503 SERVICE_UNAVAILABLE` while MongoDB is disconnected, so the host's health check (Render's `healthCheckPath`) sees a broken instance as unhealthy.

---

## Auth

### `POST /auth/login` — public, rate-limited
Body:
```json
{ "email": "priya.sharma@email.com", "password": "Author@123" }
```
| Field | Rules |
|---|---|
| `email` | valid email, trimmed, case-insensitive |
| `password` | string, 1–128 chars |
| `portal` | optional, `"author"` or `"admin"`: the sign-in tab the user chose. When set and it doesn't match the account's role, the login is refused with `403 WRONG_PORTAL`. Omit it to sign in with any role |

`200`, plus a `Set-Cookie: bl_token=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` header (and `Secure` in production):
```json
{
  "data": {
    "user": {
      "id": "665f…",
      "email": "priya.sharma@email.com",
      "name": "Priya Sharma",
      "role": "author",
      "authorProfile": { "externalId": "AUTH001", "phone": "+91-98765-43210", "city": "Mumbai", "joinedDate": "2023-03-15T00:00:00.000Z" }
    }
  }
}
```
Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 WRONG_PORTAL`, `429 RATE_LIMITED`.

The portal check runs only **after** the password is verified, so a wrong password always gets the generic 401 and the tab can't be used to find out which emails are admin accounts. Both portals share the same session cookie and JWT; the role inside the token decides what the user can do.

### `POST /auth/logout` — public
Clears `bl_token` and returns `204`. It's idempotent: calling it without a session is fine.

### `GET /auth/me` — authenticated
`200 { "data": { "user": { ...same shape as login... } } }`
Errors: `401 UNAUTHENTICATED`.

### `GET /auth/socket-token` — authenticated
Exchanges the session cookie for a token for the Socket.IO handshake. The cookie is httpOnly and the Next.js rewrite can't proxy WebSockets, so the browser connects to the API origin directly with this token.
```json
{ "data": { "token": "eyJ…", "url": "http://localhost:4000", "expiresIn": 60 } }
```
- `token`: an HS256 JWT with `aud: "bookleaf-socket"`, valid for **60 s** (only the handshake needs it). It is rejected as a session cookie, and a session token is rejected at the socket handshake.
- `url`: where to connect (`SOCKET_PUBLIC_URL`), so the client needs no `NEXT_PUBLIC_` variable.
- Sent with `Cache-Control: no-store`.

Errors: `401 UNAUTHENTICATED`.

---

## Books

### `GET /books` — authenticated
- **Author**: their own books only. Any `authorId` query is ignored (the scope always wins).
- **Admin**: all books. Optional `?authorId=<userId>` filter.

| Query | Rules |
|---|---|
| `authorId` | optional ObjectId (admin only) |

`200`:
```json
{
  "data": [
    {
      "id": "665f…",
      "externalId": "BK001",
      "authorId": "665e…",
      "title": "Whispers of the Ganges",
      "isbn": "978-93-5XXXX-01-1",
      "genre": "Literary Fiction",
      "publicationDate": "2023-06-20T00:00:00.000Z",
      "stage": "published_live",
      "mrp": 399,
      "royaltyPerCopy": 35,
      "copiesSold": 342,
      "royalty": { "earned": 11970, "paid": 8400, "pending": 3570 },
      "lastRoyaltyPayoutDate": "2025-10-15T00:00:00.000Z",
      "printPartner": "In-House",
      "availableOn": ["Amazon India", "Flipkart", "BookLeaf Store"]
    }
  ],
  "meta": { "count": 2 }
}
```
A book in production (e.g. BK013) has `"stage": "cover_design"` and `null` for `publicationDate`, `mrp`, `royaltyPerCopy`, `lastRoyaltyPayoutDate` and `printPartner`.

### `GET /books/:id` — authenticated
`:id` is an ObjectId or a dataset ID (`BK001`).
- Author + own book → `200 { data: book }`
- Author + another author's book → **`404 NOT_FOUND`** (we don't reveal that it exists)
- Admin → any book

---

## Authors (admin)

### `GET /authors` — admin only
Every author, with portfolio stats aggregated from `books`. Sorted by name.

`200`:
```json
{
  "data": [
    {
      "id": "665e…",
      "name": "Priya Sharma",
      "email": "priya.sharma@email.com",
      "authorProfile": { "externalId": "AUTH001", "phone": "…", "city": "Mumbai", "joinedDate": "…" },
      "stats": {
        "books": 2, "published": 2, "inProduction": 0,
        "copiesSold": 531, "royaltyEarned": 19908, "royaltyPaid": 16338, "royaltyPending": 3570
      }
    }
  ],
  "meta": { "count": 10 }
}
```
Errors: `401 UNAUTHENTICATED`, `403 FORBIDDEN` (authors).

---

## Admins (admin)

### `GET /admins` — admin only
The support team, for the ticket assignee picker. Sorted by name. Only `id` and `name` are returned.

`200`:
```json
{
  "data": [
    { "id": "6660…", "name": "Aisha Verma (Support Lead)" },
    { "id": "6661…", "name": "Rahul Mehta (Support Agent)" }
  ],
  "meta": { "count": 2 }
}
```
Pass an `id` as `assigneeId` to `PATCH /tickets/:id`.
Errors: `401 UNAUTHENTICATED`, `403 FORBIDDEN` (authors).

---

## Tickets

The same endpoints serve both roles, but the **payload depends on who asks**:

| Field | Author | Admin |
|---|---|---|
| `id, ticketNumber, book, subject, description, attachments, status, category, lastReplyRole, lastActivityAt, resolvedAt, createdAt, updatedAt` | ✓ | ✓ |
| `author, priority, priorityRank, prioritySource, categorySource, assignee, isActive, isStale, ai` | ✗ | ✓ |
| Internal notes, author context (books), `messages[].aiAssisted` | ✗ | ✓ |

An author asking for another author's ticket gets **404**. Internal notes are never in an author payload.

### `POST /tickets` — author only
| Field | Rules |
|---|---|
| `bookId` | ObjectId of **one of the author's own books**, or `null` for "General / Account Level" (default `null`) |
| `subject` | 5–150 chars, trimmed |
| `description` | 20–5,000 chars, trimmed |
| `attachments` | up to 5 × `{ name, size (≤ 10 MB), mimeType }`. Metadata only; upload is out of scope. Default `[]` |

`201 { data: ticket }`. The ticket gets a human-friendly number (`BL-1011`, …) and is **triaged immediately** by the keyword classifier (`categorySource`/`prioritySource = "fallback"`, `ai.state = "pending"`). The response never waits for the LLM. A background job then classifies it with the LLM:
- **On success:** `ai.state = "done"`, `ai.classification` is recorded, and category/priority switch to `source = "ai"`, unless an admin has already overridden them.
- **On failure:** `ai.state = "failed"` with a short `ai.error`, and the keyword triage stays in place.

Either way a `ticket:updated` socket event follows.
Errors: `400 VALIDATION_ERROR` (incl. `body.bookId` when the book isn't the author's), `403` for admins.

### `GET /tickets` — authenticated
Authors get their own tickets. Admins get the whole queue.

| Query | Rules |
|---|---|
| `status` | comma list of `open,in_progress,resolved,closed` |
| `category` | comma list of category ids |
| `priority` | comma list of `critical,high,medium,low` (**admin only**, ignored for authors) |
| `assignee` | `me`, `unassigned` or an admin's ObjectId (**admin only**) |
| `authorId` | ObjectId (**admin only**) |
| `from`, `to` | `YYYY-MM-DD`, created-on range, inclusive |
| `q` | ≤ 100 chars. Case-insensitive match on subject, description and ticket number |
| `sort` | `urgency` (default), `newest`, `oldest`, `updated`, `idle` |
| `page`, `limit` | `page ≥ 1` (default 1), `1 ≤ limit ≤ 100` (default 20) |

`sort=urgency` for admins: **active (open/in progress) first → priority (critical → low) → oldest first**. For authors it means active first, then most recently updated (authors never see priority).

`200`:
```json
{
  "data": [ { "id": "…", "ticketNumber": "BL-1001", "subject": "No royalty received in over 6 months",
              "status": "open", "category": "royalty_payments", "priority": "critical", "prioritySource": "ai",
              "author": { "id": "…", "name": "Arjun Malhotra", "email": "…", "externalId": "AUTH006" },
              "assignee": null, "isActive": true, "isStale": true, "lastReplyRole": null, "…": "…" } ],
  "meta": { "count": 20, "total": 31, "page": 1, "limit": 20, "pages": 2 }
}
```
`isStale` = active with no activity for more than 48 hours.
Errors: `400 VALIDATION_ERROR` (e.g. `query.status.0`, `query.limit`).

### `GET /tickets/stats` — admin only
```json
{ "data": {
  "byStatus": { "open": 6, "in_progress": 2, "resolved": 1, "closed": 1 },
  "activeByPriority": { "critical": 1, "high": 4, "medium": 2, "low": 1, "unscored": 0 },
  "activeUnassigned": 5, "activeStale": 2, "assignedToMe": 1 } }
```

### `GET /tickets/:id` — authenticated
- **Author** (own ticket): `{ data: { ticket, messages } }`
- **Admin**: `{ data: { ticket (incl. ai.classification + ai.draft), messages, notes, authorContext: { books, activeTickets, totalTickets } } }`

`messages[]`: `{ id, body, senderRole, sender: { id, name }, createdAt, aiAssisted? }`, oldest first. The original request is `ticket.description`.
Errors: `400` malformed id, `404` missing or another author's ticket.

### `PATCH /tickets/:id` — admin only
Any of the following (at least one; unknown fields are rejected):

| Field | Effect |
|---|---|
| `status` | Sets status. `resolved`/`closed` stamp `resolvedAt`; reopening clears it |
| `category` | Override. Sets `categorySource = "admin"`; the original AI verdict stays in `ai.classification` |
| `priority` | Override. Sets `priorityRank` and `prioritySource = "admin"` |
| `assigneeId` | An admin's ObjectId, or `null` to unassign. A non-admin id → `400 body.assigneeId` |

Every update bumps `lastActivityAt`. `200 { data: ticket }`.

### `POST /tickets/:id/messages` — authenticated (own ticket for authors)
Body: `{ body: 1–10,000 chars, aiAssisted?: boolean }`. `aiAssisted` is honoured for admins only.
Automatic status changes:
- an admin reply on an `open` ticket moves it to `in_progress`
- an author reply on a `resolved` ticket reopens it to `open`

`201 { data: message }`. Errors: `404`, `409 TICKET_CLOSED` (closed tickets take no replies).

### `POST /tickets/:id/notes` — admin only
Body: `{ body: 1–5,000 chars }`. `201 { data: { id, body, admin: { id, name }, createdAt } }`. Notes are stored in a separate collection and never returned to authors.

---

## AI assistance (admin only)

Drafts are **never sent automatically**. The admin edits the text and sends it through `POST /tickets/:id/messages` with `aiAssisted: true`.

### `GET /tickets/:id/ai-draft` — admin only
Returns the cached draft. On a cache miss it generates one with the draft model and caches it. Concurrent misses on the same ticket share one model call.
```json
{ "data": { "body": "Hi Priya,

…

Warm regards,
BookLeaf Author Support",
            "model": "openai/gpt-oss-120b", "generatedAt": "2026-10-24T10:02:11.000Z" },
  "meta": { "cached": true } }
```
- **Prompt context** (cost control): only the KB section(s) for the ticket's category, the tone guide, one matching sample Q→A, a fact sheet for **this ticket's book only** (royalty figures and the computed next payout date / stage / platforms, depending on the category), and the **last 3 messages**, truncated.
- **Cache invalidation:** any new message on the ticket clears the cache. An author message needs a fresh answer, and an admin reply has just used the draft. A draft that went stale while generating (the ticket changed meanwhile) is returned but not cached.

Errors: `401`, `403` (authors, including the ticket's own author), `400` malformed id, `404`, `409 TICKET_CLOSED`, `503 AI_UNAVAILABLE` (the message tells the admin to reply manually; nothing is cached).

### `POST /tickets/:id/ai-draft` — admin only
Always calls the model and replaces the cache. Same response with `meta.cached: false`, and the same errors.

### `POST /tickets/:id/classify` — admin only
Re-runs LLM classification synchronously, e.g. after `ai.state = "failed"`. `200 { data: ticket }` (admin DTO). Admin overrides are kept, and only `fallback`/`ai` decisions are replaced. The ISBN policy floor applies: `isbn_metadata` is always at least `high`.
Errors: `401`, `403`, `400`, `404`, `503 AI_UNAVAILABLE` (the failure is recorded in `ai.error` and the keyword triage stays).

---

## Real-time (Socket.IO)

Connect to `url` from `GET /auth/socket-token` with `io(url, { auth: { token } })`. A bad, missing, expired or session token fails the handshake with `connect_error: "UNAUTHENTICATED"`.

| Room | Who joins | Receives |
|---|---|---|
| `user:<id>` | every user | events for their own tickets |
| `admins` | admins | events for every ticket |

| Event | Emitted when | To |
|---|---|---|
| `ticket:updated` | ticket created; AI classification finished or failed; admin `PATCH` | author + admins |
| `ticket:updated` | internal note added | admins only |
| `ticket:message` | any reply posted | author + admins |

The payload is always `{ ticketId, ticketNumber }`. Events only **invalidate**: the client re-fetches through the REST endpoints above, so RBAC and DTO whitelisting stay in one place and no ticket content (or admin-only data) travels over the socket. If the socket can't connect, the web client falls back to polling every 15 s.

---

## Try it with curl

```bash
# login (stores cookie)
curl -i -c jar.txt -H "Content-Type: application/json" \
  -d '{"email":"priya.sharma@email.com","password":"Author@123"}' \
  http://localhost:4000/api/v1/auth/login

curl -b jar.txt http://localhost:4000/api/v1/auth/me
curl -b jar.txt http://localhost:4000/api/v1/books          # Priya's 2 books
curl -b jar.txt http://localhost:4000/api/v1/books/BK003    # 404 (Rohit's book)
curl -b jar.txt http://localhost:4000/api/v1/authors        # 403 (admin only)
curl -X POST -b jar.txt -c jar.txt http://localhost:4000/api/v1/auth/logout   # 204
```

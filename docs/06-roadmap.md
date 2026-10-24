# 06 — Roadmap

Four-day budget. The brief says to prioritise *"the core ticket flow and AI integration over nice-to-have features"*.

## Phase 1 — Foundation ✅ (current)
- [x] Requirements written up as IDs (`01-requirements.md`)
- [x] Architecture, data model, API conventions, seed plan (`02`–`05`)
- [x] CLAUDE.md + project skills (`.claude/skills/`)
- [x] Monorepo scaffold: `packages/shared`, `server`, `client`
- [x] Zod-validated env, central error handling, `{ data }` / `{ error }` envelopes
- [x] Mongoose models: User, Book, Ticket, Message, InternalNote, Counter
- [x] Idempotent seed script (10 authors, 18 books, 2 admins)
- [x] Login / logout / me, `requireAuth`, `requireRole`, service-level ownership scoping
- [x] `GET /books`, `GET /books/:id`, `GET /authors`
- [x] Jest + Supertest tests: auth, RBAC matrix, seed
- [x] Client: login page, route guard, logout, placeholder dashboards

## Phase 2 — Tickets core ✅
- [x] Shared Zod schemas for tickets
- [x] `POST/GET /tickets`, `GET/PATCH /tickets/:id`, `GET /tickets/stats`, messages, notes
- [x] Keyword fallback classifier (instant triage on create; the AI safety net for Phase 3)
- [x] Author: dashboard (royalty summary, payout explanation), My Books (production stage progress, payout status), New Ticket form (book preselect, attachment metadata), My Tickets list and detail with replies
- [x] Admin: dashboard (queue stats, needs-attention list), queue (status/category/priority/assignee/author/date/search filters, urgency sort, stale and awaiting-reply flags, pagination), ticket workspace (status, category/priority overrides with source badges, assign, reply + resolve, internal notes, author context), authors page
- [x] Seed demo tickets
- [x] Tests: ticket RBAC matrix, lifecycle transitions, notes isolation, filters/sort/pagination, fallback classifier, payout-window maths

## Phase 3 — AI (Groq)
- [ ] `AiProvider` interface + `GroqProvider` (timeouts, one retry, JSON mode)
- [ ] KB split into sections + tone guide + sample Q→A
- [ ] `classifyTicket` (small model) → async on create; keyword fallback
- [ ] `draftReply` (larger model) → cached on the ticket; regenerate; manual fallback UI
- [ ] Admin override of category and priority (`source=admin`)
- [ ] Token logging per call (cost evidence for the README)
- [ ] Tests with a mocked provider: success, timeout, bad JSON → fallback

## Phase 4 — Real-time
- [ ] Socket.IO server, `socket-token` endpoint, rooms
- [ ] Emit on status, message and classification changes
- [ ] Client hook with a polling fallback

## Phase 5 — Polish & product
- [x] Empty states, loading skeletons, royalty explanations, stale-ticket badges *(done in Phase 2)*
- [x] Admin queue counters *(done in Phase 2)*
- [ ] Real file upload for attachments (bonus)
- [ ] Admin "assign to teammate" dropdown (the API already supports any admin id)

## Phase 6 — Ship
- [ ] Deploy: Atlas, then Render, then Vercel. Seed production.
- [ ] README (setup, architecture, AI strategy, API link, limitations, credentials)
- [ ] One-page write-up

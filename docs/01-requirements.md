# 01 — Requirements

Source: `assignment_doc/FULLSTACK-ASSIGNMENT.pdf` (BookLeaf Publishing, Assignment 1 of 2).
Goal: an **Author Support & Communication Portal** that lets BookLeaf's ops team handle author queries faster, more consistently and with less manual effort.

Each requirement has an ID so code, tests and the roadmap can refer to it. The **Grade** column maps to the evaluation criteria in the brief:
AI = AI Integration (25%), ARCH = Architecture & Code (25%), API = API Design (15%), FUNC = Functionality (15%), PROD = Product Thinking (10%), DOCS = Documentation (10%).

---

## 1. Actors

| Actor | Description |
|---|---|
| **Author** | A BookLeaf author (seeded from the sample JSON). Sees only their own books, royalties and tickets. |
| **Admin** | A BookLeaf support/ops team member. Sees every ticket and every author. |
| **AI assistant** | A server-side service (Groq / Llama) that classifies tickets, scores priority and drafts replies. It never sends anything to an author by itself. |

---

## 2. Functional requirements

### 2.1 Authentication & access (AUTH)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| AUTH-1 | Email + password login. No OTP or social login. | FUNC | Foundation |
| AUTH-2 | The session is a JWT in a **secure, httpOnly cookie**. The browser JS never sees the token. | API | Foundation |
| AUTH-3 | Logout clears the session cookie. | FUNC | Foundation |
| AUTH-4 | `GET /auth/me` returns the current user (no password hash). | API | Foundation |
| AUTH-5 | All non-public API routes need a valid session (401 otherwise). | API | Foundation |
| AUTH-6 | Role-based access: `author` and `admin`. Admin-only routes return 403 to authors. | API | Foundation |
| AUTH-7 | Authors can only reach **their own** resources. Someone else's resource returns **404** (we don't reveal that it exists). | API | Foundation |
| AUTH-8 | A failed login returns the same generic error for an unknown email and a wrong password. Login is rate-limited. | API | Foundation |
| AUTH-9 | The UI sends unauthenticated users to `/login` and sends each role to its own portal. | PROD | Foundation |

### 2.2 Author portal (AUTHOR)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| AUTHOR-1 | **My Books**: title, ISBN, genre, publication date, status, MRP, copies sold, royalty earned, paid and pending. | FUNC | Tickets core |
| AUTHOR-2 | Books in production show their production stage and "—" for MRP and sales, not ₹0 or `null`. | PROD | Tickets core |
| AUTHOR-3 | Zero or never-paid royalties are explained (e.g. "below the ₹1,000 payout threshold, rolls over to next quarter"). | PROD | Polish |
| AUTHOR-4 | **Submit ticket**: book dropdown (+ "General / Account Level"), subject, description, optional attachment (UI only; metadata stored). | FUNC | Tickets core |
| AUTHOR-5 | **My Tickets**: status (Open, In Progress, Resolved, Closed), original query, and the admin replies. | FUNC | Tickets core |
| AUTHOR-6 | Ticket changes (reply, status) show up **without a page refresh**. | FUNC | Real-time |
| AUTHOR-7 | Authors **never** see internal notes, AI drafts, AI reasoning or assignee details. | API | Tickets core |

### 2.3 Admin portal (ADMIN)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| ADMIN-1 | **Ticket queue** across all authors. | FUNC | Tickets core |
| ADMIN-2 | Filter by status, category, priority and date range. | FUNC | Tickets core |
| ADMIN-3 | Default sort puts the most urgent and oldest unresolved tickets first (priority rank, then age). Age is shown. | PROD | Tickets core |
| ADMIN-4 | Change ticket status. | FUNC | Tickets core |
| ADMIN-5 | Add **internal notes** that authors can't see. | FUNC | Tickets core |
| ADMIN-6 | Assign a ticket to themselves (or unassign it). | FUNC | Tickets core |
| ADMIN-7 | Override the AI category and priority. The source of each value (`ai` / `admin` / `fallback`) is recorded. | AI | AI |
| ADMIN-8 | Open a ticket and see an **AI-drafted reply**. Edit it, then send. The sent reply appears on the author's ticket. | AI | AI |
| ADMIN-9 | Write a reply by hand when the AI is down or the draft isn't useful. | AI | AI |
| ADMIN-10 | The ticket detail shows the author's context (books, royalty figures) next to the ticket. | PROD | Tickets core |

### 2.4 AI assistant (AI)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| AI-1 | Classify each new ticket into exactly one of: **Royalty & Payments, ISBN & Metadata Issues, Printing & Quality, Distribution & Availability, Book Status & Production Updates, General Inquiry**. | AI | AI |
| AI-2 | Give each ticket a priority: **Critical / High / Medium / Low**, based on its content (e.g. "no royalty for 6 months" ranks above "update my bio"). ISBN errors are at least High, per policy. | AI | AI |
| AI-3 | Draft a reply grounded in the **BookLeaf Knowledge Base** and the author's real book data, following the tone guidelines (empathetic, specific, owns the fault, clear timeline, clear next step). | AI | AI |
| AI-4 | AI output is **never sent automatically**. An admin always reviews it. | AI | AI |
| AI-5 | **Graceful degradation**: if the LLM is down, rate-limited or returns bad JSON, the ticket is still created. A keyword fallback sets category and priority (`source: fallback`), and the admin can write the reply by hand. | AI | AI |
| AI-6 | **Cost awareness**: send only the relevant KB sections (by category) and a compact book summary, not the whole KB or the full ticket history. Use a small model for classification and a larger one for drafts. Cache drafts on the ticket and only regenerate on request. | AI | AI |
| AI-7 | API keys live only in server env vars. Nothing AI-related is exposed to the client bundle. | AI | Foundation |
| AI-8 | Structured (JSON-mode) output, validated with Zod before use. | AI | AI |

### 2.5 API layer (API)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| API-1 | REST, versioned under `/api/v1`, plural resource nouns, consistent naming. | API | Foundation |
| API-2 | Auth middleware on every non-public route. | API | Foundation |
| API-3 | Input validation (Zod) with meaningful 4xx errors that say which field failed. | API | Foundation |
| API-4 | One response shape: `{ data }` on success, `{ error: { code, message, details? } }` on failure. No raw 500 stack traces. | API | Foundation |
| API-5 | Every endpoint is documented in `docs/04-api.md`. | DOCS | Foundation (kept up to date) |

### 2.6 Real-time (RT)

| ID | Requirement | Grade | Phase |
|---|---|---|---|
| RT-1 | Socket.IO pushes `ticket:updated` / `ticket:message` to the ticket's author and to admins. | FUNC | Real-time |
| RT-2 | The socket handshake is authenticated. Authors only join their own room. | API | Real-time |
| RT-3 | The UI falls back to polling if the socket can't connect. | PROD | Real-time |

---

## 3. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | bcrypt password hashes, httpOnly + Secure + SameSite cookies, helmet, CORS allow-list, rate-limited login, secrets only in env, env validated at boot. |
| Reliability | Ticket creation never depends on the LLM being up. Startup fails fast on bad config. |
| Maintainability | TypeScript everywhere. Feature modules (routes → controller → service → model). Enums and request schemas are shared between client and server. |
| Testability | The Express app is built without `listen()`. API tests use an in-memory MongoDB. |
| Performance | Indexes match the queue's filter and sort patterns. List endpoints use lean queries. |
| Deployability | Client on Vercel, API on Render, MongoDB Atlas. Pre-seeded with the provided dataset. |

---

## 4. Data edge cases the system must handle

From the brief: *"some published and earning royalties, some with pending payouts, some with zero payouts, and two still in production."*

| Case | Records | Expected handling |
|---|---|---|
| In production: null MRP, publication date, royalty-per-copy and print partner; 0 sales; no platforms | BK013 (Cover Design), BK015 (Typesetting) | Show the stage and a progress indicator. Hide the money columns. The AI uses the stage in production-update replies. |
| Published but never paid (`royalty_paid = 0`, no payout date) | BK005, BK010, BK016, BK018 | Show "No payout yet". The AI explains the quarterly cycle and 45-day window. |
| Pending below the ₹1,000 threshold | BK016 (₹850) | Explain the roll-over rule. |
| Fully paid (`pending = 0`) | BK002, BK007, BK008, BK014 | Show "All caught up". |
| Mixed portfolio | AUTH007 (3 books, one in production), AUTH009 (one live, one in production) | The book dropdown lists all books. The AI only gets data for the selected book. |
| Unicode in titles | BK017 "Durga’s Daughters" | Stored and rendered as-is. |
| Placeholder ISBNs (`978-93-5XXXX-..`) | all | Stored as strings. No checksum validation. |
| Empty states | authors with no tickets, an empty queue after filtering | Friendly empty-state copy. |

---

## 5. Out of scope (stated assumptions)

- Real file upload storage. Only attachment metadata is stored (the brief says upload is a bonus).
- Author self-registration and password reset. Accounts are seeded.
- Email notifications. Real-time in-app updates cover the requirement.
- Multi-tenant or fine-grained admin roles. There is one `admin` role.
- Payment or royalty calculation engines. Royalty figures come from the dataset as-is.

---

## 6. Deliverables checklist (from the brief)

- [ ] Public Git repo with a clean commit history
- [ ] Live demo URL (author + admin portals), pre-seeded
- [ ] README: local setup, architecture decisions, AI integration (prompts, errors, cost), API docs link, limitations, test credentials
- [ ] One-page write-up: priorities, trade-offs, path to production

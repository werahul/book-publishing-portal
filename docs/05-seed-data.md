# 05 — Seed Data

Source: `assignment_doc/FULLSTACK-SAMPLEDATA.json`. It's copied, unchanged, to `server/src/seed/data/bookleaf_sample_data.json`. BookLeaf will test with these exact records.

## Running

```bash
npm run seed                 # upsert: safe to run repeatedly
npm run seed -- --reset      # wipe users/books/tickets/messages/notes/counters first
```

Env (all optional, defaults shown):

| Var | Default | Purpose |
|---|---|---|
| `SEED_AUTHOR_PASSWORD` | `Author@123` | Password for all 10 authors |
| `SEED_ADMIN_PASSWORD` | `Admin@123` | Password for both admins |

## Demo credentials

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` | BookLeaf Support Lead |
| Admin | `support@bookleaf.com` | `Admin@123` | Second agent, for assignment demos |
| Author | `priya.sharma@email.com` | `Author@123` | 2 live books, pending + fully paid |
| Author | `sneha.kulkarni@email.com` | `Author@123` | 3 books, one in production (Cover Design) |
| Author | `kavita.deshmukh@email.com` | `Author@123` | One in Typesetting, one live with ₹850 pending (below threshold) |
| Author | `ananya.reddy@email.com` | `Author@123` | Live, never paid |
| …the other 6 authors | email from the JSON | `Author@123` | |

## Pipeline

```
read JSON → validate raw shape (Zod, raw-schema.ts) → map (mappers.ts) → integrity checks (warn) → hash passwords → bulkWrite upserts
```

1. **Validate** against a strict Zod schema of the raw format. If BookLeaf's file had an unexpected status label or a missing field, the seed stops with a clear error and doesn't write half the data.
2. **Map** (pure functions, unit-tested):

| JSON | Model |
|---|---|
| `author_id` | `users.authorProfile.externalId` |
| `name`, `email` (lower-cased), `phone`, `city` | `users.name`, `users.email`, `authorProfile.phone`, `authorProfile.city` |
| `joined_date` | `authorProfile.joinedDate` (Date) |
| `book_id` | `books.externalId` |
| `publication_date` (`null` allowed) | `books.publicationDate` |
| `status` | `books.stage` via the label map below |
| `author_royalty_per_copy` | `books.royaltyPerCopy` |
| `total_copies_sold` | `books.copiesSold` |
| `total_royalty_earned` / `royalty_paid` / `royalty_pending` | `books.royalty.earned` / `.paid` / `.pending` |
| `last_royalty_payout_date` | `books.lastRoyaltyPayoutDate` |
| `print_partner`, `available_on` | `books.printPartner`, `books.availableOn` |

Status label → `stage`:

| Label in JSON | `stage` |
|---|---|
| `Published & Live` | `published_live` |
| `In Production - Cover Design` | `cover_design` |
| `In Production - Typesetting` | `typesetting` |
| `In Production - <Any KB stage>` | matching enum (manuscript_received, editing, proofreading, isbn_assignment, printing, distribution_setup) |
| anything else | **error**: the seed aborts |

3. **Integrity checks** (logged as warnings, never fatal):
   - `royalty.earned === royalty.paid + royalty.pending`
   - `royalty.earned === copiesSold × royaltyPerCopy` (published books)
   - All 18 books pass both checks in the provided file.
4. **Upsert**: users by `email`, books by `externalId`. Running it twice changes nothing. Running it after editing the JSON updates the records in place.
5. **Admins**: two admin users are created (they aren't in the dataset).

## Edge cases present in the data

| Case | Records |
|---|---|
| In production (null MRP, publication date, royalty-per-copy, print partner; 0 sales) | BK013 (AUTH007, Cover Design), BK015 (AUTH009, Typesetting) |
| Published, never paid (`royalty_paid = 0`, payout date `null`) | BK005, BK010, BK016, BK018 |
| Pending below the ₹1,000 payout threshold | BK016 (₹850) |
| Fully paid (`pending = 0`) | BK002, BK007, BK008, BK014 |
| Several print partners | In-House, Repro India, Epitome Books |
| Unicode punctuation | BK017 `Durga’s Daughters` (U+2019) |
| Placeholder ISBNs | `978-93-5XXXX-NN-C` (not checksum-valid; stored verbatim) |

## Demo tickets (`server/src/seed/demo-tickets.ts`)

Ten tickets (`BL-1001` … `BL-1010`) are seeded so the queue isn't empty on first login. Each one is only inserted if its ticket number doesn't exist yet, so demo changes survive a re-seed (`--reset` restores them). Ages are relative to seed time. The ticket counter is bumped so new tickets start at `BL-1011`.

| # | Author | Book | Category / priority | State | Demonstrates |
|---|---|---|---|---|---|
| 1001 | Arjun | BK010 | Royalty / **Critical** | Open, unassigned, 80 h old | Top of the queue, **stale** |
| 1002 | Rohit | BK003 | ISBN / High | In progress, Aisha | Reply in tone, **internal note**, stale while waiting on production |
| 1003 | Meera | BK009 | Printing / High | Open, 6 h | Fresh defect report |
| 1004 | Vikram | BK007 | Distribution / High | Open, Rahul | Assigned but not yet answered |
| 1005 | Kavita | BK015 (Typesetting) | Production / Medium | In progress, Rahul | Book in production; author replied last |
| 1006 | Priya | General | General / Low | Resolved | Account-level ticket, resolved history |
| 1007 | Sneha | BK013 (Cover Design) | Production / Low | Open, 3 h | Book in production |
| 1008 | Farhan | BK014 | Royalty / Medium | Closed | Net-profit explanation, closed (no replies) |
| 1009 | Kavita | BK016 | Royalty / Medium | Open | ₹850 below the ₹1,000 threshold |
| 1010 | Ananya | BK005 | Royalty / High | Open | Never paid since publication |

Diya Chatterjee has **no tickets**, so you can log in as her to see the empty states. Demo AI fields are pre-filled (`source: ai`, `model: "seed"`) so the queue looks realistic without calling the LLM.

---
name: seed-data
description: Running, resetting and extending the BookLeaf seed script (sample authors/books from FULLSTACK-SAMPLEDATA.json, demo admins, later demo tickets). Use when changing models that the seed writes, adding demo data, or debugging seed failures.
---

# Seed data

Code is in `server/src/seed/`:
- `data/bookleaf_sample_data.json`: a verbatim copy of `assignment_doc/FULLSTACK-SAMPLEDATA.json`. **Never edit it.** BookLeaf tests against these exact records.
- `raw-schema.ts`: a strict Zod schema of the raw snake_case file. Unknown fields or bad values abort the seed.
- `mappers.ts`: pure functions (`mapAuthor`, `mapBook`, `mapStatusToStage`, `integrityWarnings`), unit-tested in `tests/seed.test.ts`.
- `seed.ts`: `seedDatabase(options)`. Idempotent `bulkWrite` upserts (users by `email`, books by `externalId`). Passwords use `$setOnInsert`.
- `cli.ts`: the `npm run seed [-- --reset]` entry point.

## Running
```bash
npm run seed              # upsert into MONGODB_URI from server/.env
npm run seed -- --reset   # wipe users/books/tickets/messages/notes/counters first
```
Passwords: `SEED_AUTHOR_PASSWORD` (default `Author@123`) and `SEED_ADMIN_PASSWORD` (default `Admin@123`). Admins are `admin@bookleaf.com` and `support@bookleaf.com` (see `SEED_ADMINS`).

## Status → stage mapping
`"Published & Live"` → `published_live`. `"In Production - <Stage Label>"` → the matching `PRODUCTION_STAGES` value (labels come from `PRODUCTION_STAGE_LABELS` in `@bookleaf/shared`). Anything else throws. Don't add a silent default.

## Extending (e.g. demo tickets in the Tickets phase)
1. Add a step to `seedDatabase` after the books step. Look up authors and books by email or `externalId`, never by hard-coded ObjectIds.
2. Keep it idempotent: upsert on a natural key (e.g. a fixed `ticketNumber` like `BL-0001`), and add the collection to the `--reset` wipe list.
3. Pre-fill AI fields (`category`, `priority`, `priorityRank`, `*Source: 'ai'`, `ai.state: 'done'`) so the queue looks realistic without calling the LLM.
4. Cover the edge cases: BK013/BK015 in production, never-paid books (BK005, BK010, BK016, BK018), and BK016 below the ₹1,000 threshold.
5. Update `docs/05-seed-data.md` and add assertions to `tests/seed.test.ts`.

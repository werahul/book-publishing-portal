import { hashPassword } from '../lib/password';
import { Book } from '../modules/books/book.model';
import { Counter } from '../modules/tickets/counter.model';
import { InternalNote } from '../modules/tickets/internal-note.model';
import { Message } from '../modules/tickets/message.model';
import { Ticket } from '../modules/tickets/ticket.model';
import { User } from '../modules/users/user.model';
import sampleData from './data/bookleaf_sample_data.json';
import { seedDemoTickets } from './demo-tickets';
import { integrityWarnings, mapAuthor, mapBook } from './mappers';
import { rawDatasetSchema } from './raw-schema';

/** Admins are not part of BookLeaf's dataset; these two let reviewers demo assignment. */
export const SEED_ADMINS = [
  { email: 'admin@bookleaf.com', name: 'Aisha Verma (Support Lead)' },
  { email: 'support@bookleaf.com', name: 'Rahul Mehta (Support Agent)' },
] as const;

export interface SeedOptions {
  authorPassword: string;
  adminPassword: string;
  /** Wipe all collections first (fresh demo). */
  reset?: boolean;
  /** Defaults to the bundled BookLeaf sample file. */
  dataset?: unknown;
  logger?: Pick<Console, 'log' | 'warn'>;
  /** Add the demo ticket queue (default true). */
  demoTickets?: boolean;
}

export interface SeedSummary {
  authors: number;
  admins: number;
  books: number;
  demoTickets: number;
  warnings: string[];
}

/**
 * Idempotent: users are upserted by email, books by externalId. Re-running
 * updates records in place. Passwords are only set on insert, so re-seeding
 * doesn't reset a password that was changed later (use --reset for that).
 */
export async function seedDatabase(options: SeedOptions): Promise<SeedSummary> {
  const log = options.logger ?? console;
  const dataset = rawDatasetSchema.parse(options.dataset ?? sampleData);

  if (options.reset) {
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Ticket.deleteMany({}),
      Message.deleteMany({}),
      InternalNote.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    log.log('[seed] reset: all collections cleared');
  }

  // Make sure unique indexes exist before upserting, so duplicates fail loudly.
  await Promise.all([User.syncIndexes(), Book.syncIndexes()]);

  const authors = dataset.authors.map((raw) => ({ author: mapAuthor(raw), books: raw.books.map(mapBook) }));
  const warnings = authors.flatMap(({ books }) => books.flatMap(integrityWarnings));

  // ── Users ────────────────────────────────────────────────────────────────
  const userDocs = [
    ...authors.map(({ author }) => ({ ...author, password: options.authorPassword })),
    ...SEED_ADMINS.map((admin) => ({ ...admin, role: 'admin' as const, password: options.adminPassword })),
  ];

  const userOps = await Promise.all(
    userDocs.map(async ({ password, ...doc }) => ({
      updateOne: {
        filter: { email: doc.email },
        update: { $set: doc, $setOnInsert: { passwordHash: await hashPassword(password) } },
        upsert: true,
      },
    })),
  );
  await User.bulkWrite(userOps);

  // ── Books ────────────────────────────────────────────────────────────────
  const userIds = new Map(
    (await User.find({ email: { $in: userDocs.map((u) => u.email) } }, { email: 1 }).lean()).map(
      (u) => [u.email, u._id],
    ),
  );

  const bookOps = authors.flatMap(({ author, books }) =>
    books.map((book) => ({
      updateOne: {
        filter: { externalId: book.externalId },
        update: { $set: { ...book, author: userIds.get(author.email) } },
        upsert: true,
      },
    })),
  );
  await Book.bulkWrite(bookOps);

  // ── Demo tickets (only ones that don't exist yet) ────────────────────────
  const demoTickets = options.demoTickets === false ? 0 : await seedDemoTickets();

  for (const warning of warnings) log.warn(`[seed] warning: ${warning}`);

  return {
    authors: authors.length,
    admins: SEED_ADMINS.length,
    books: bookOps.length,
    demoTickets,
    warnings,
  };
}

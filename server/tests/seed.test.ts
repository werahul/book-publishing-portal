import { Book } from '../src/modules/books/book.model';
import { InternalNote } from '../src/modules/tickets/internal-note.model';
import { Message } from '../src/modules/tickets/message.model';
import { Ticket } from '../src/modules/tickets/ticket.model';
import { User } from '../src/modules/users/user.model';
import { integrityWarnings, mapBook, mapStatusToStage } from '../src/seed/mappers';
import sampleData from '../src/seed/data/bookleaf_sample_data.json';
import { rawDatasetSchema } from '../src/seed/raw-schema';
import { seedSample, startTestDb, stopTestDb } from './helpers';

describe('mappers (pure)', () => {
  it.each([
    ['Published & Live', 'published_live'],
    ['In Production - Cover Design', 'cover_design'],
    ['In Production - Typesetting', 'typesetting'],
    ['In Production – Proofreading', 'proofreading'],
    ['in production - isbn assignment', 'isbn_assignment'],
  ])('maps status "%s" → %s', (label, stage) => {
    expect(mapStatusToStage(label)).toBe(stage);
  });

  it('throws on an unknown status instead of guessing', () => {
    expect(() => mapStatusToStage('Lost in the post')).toThrow(/Unknown book status/);
  });

  it('the provided dataset passes every integrity check', () => {
    const dataset = rawDatasetSchema.parse(sampleData);
    const warnings = dataset.authors.flatMap((a) => a.books.map(mapBook)).flatMap(integrityWarnings);
    expect(warnings).toEqual([]);
  });

  it('rejects a dataset with unexpected fields', () => {
    const broken = structuredClone(sampleData) as { authors: Record<string, unknown>[] };
    broken.authors[0]!.surprise = true;
    expect(rawDatasetSchema.safeParse(broken).success).toBe(false);
  });
});

describe('seedDatabase', () => {
  beforeAll(async () => {
    await startTestDb();
    await seedSample();
  });
  afterAll(stopTestDb);

  it('creates 10 authors, 2 admins and 18 books', async () => {
    expect(await User.countDocuments({ role: 'author' })).toBe(10);
    expect(await User.countDocuments({ role: 'admin' })).toBe(2);
    expect(await Book.countDocuments()).toBe(18);
  });

  it('stores password hashes, never plain text', async () => {
    const user = await User.findOne({ email: 'priya.sharma@email.com' }).select('+passwordHash').lean();
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('keeps nulls for books in production', async () => {
    const bk013 = await Book.findOne({ externalId: 'BK013' }).lean();
    expect(bk013).toMatchObject({
      stage: 'cover_design',
      mrp: null,
      publicationDate: null,
      royaltyPerCopy: null,
      printPartner: null,
      copiesSold: 0,
      availableOn: [],
    });
    expect((await Book.findOne({ externalId: 'BK015' }).lean())!.stage).toBe('typesetting');
  });

  it('links each book to the right author', async () => {
    const sneha = await User.findOne({ email: 'sneha.kulkarni@email.com' }).lean();
    const ids = (await Book.find({ author: sneha!._id }).sort({ externalId: 1 }).lean()).map((b) => b.externalId);
    expect(ids).toEqual(['BK011', 'BK012', 'BK013']);
  });

  it('preserves unicode titles', async () => {
    expect((await Book.findOne({ externalId: 'BK017' }).lean())!.title).toBe('Durga’s Daughters');
  });

  it('adds 10 demo tickets with threads and notes, leaving Diya without tickets', async () => {
    expect(await Ticket.countDocuments()).toBe(10);
    expect(await Message.countDocuments()).toBeGreaterThan(0);
    expect(await InternalNote.countDocuments()).toBeGreaterThan(0);
    const diya = await User.findOne({ email: 'diya.chatterjee@email.com' }).lean();
    expect(await Ticket.countDocuments({ author: diya!._id })).toBe(0);
  });

  it('back-dates demo tickets so the queue shows realistic ages', async () => {
    const oldest = await Ticket.findOne({ ticketNumber: 'BL-1001' }).lean();
    const ageHours = (Date.now() - oldest!.createdAt.getTime()) / 3_600_000;
    expect(ageHours).toBeGreaterThan(79);
  });

  it('is idempotent: running again creates no duplicates', async () => {
    const summary = await seedSample({ reset: false });
    expect(summary.demoTickets).toBe(0);
    expect(await User.countDocuments()).toBe(12);
    expect(await Book.countDocuments()).toBe(18);
    expect(await Ticket.countDocuments()).toBe(10);
  });
});

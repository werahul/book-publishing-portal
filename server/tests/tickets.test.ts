import request from 'supertest';
import { User } from '../src/modules/users/user.model';
import { ADMIN, app, loginAs, PRIYA, ROHIT, seedSample, startTestDb, stopTestDb } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;
interface TicketJson {
  id: string;
  ticketNumber: string;
  status: string;
  priority?: string;
  [key: string]: unknown;
}

const ADMIN_ONLY_FIELDS = ['priority', 'priorityRank', 'prioritySource', 'categorySource', 'assignee', 'ai', 'author', 'isStale'];

let priya: Agent;
let rohit: Agent;
let admin: Agent;
let support: Agent;

/** Look a demo ticket up by number through the admin API. */
async function demoTicket(ticketNumber: string): Promise<TicketJson> {
  const res = await admin.get(`/api/v1/tickets?q=${ticketNumber}`);
  const ticket = (res.body.data as TicketJson[]).find((t) => t.ticketNumber === ticketNumber);
  if (!ticket) throw new Error(`demo ticket ${ticketNumber} missing`);
  return ticket;
}

async function createAsPriya(overrides: Record<string, unknown> = {}) {
  return priya.post('/api/v1/tickets').send({
    bookId: null,
    subject: 'Question about my author dashboard',
    description: 'I would like to understand where to find my sales report per platform.',
    ...overrides,
  });
}

beforeAll(async () => {
  await startTestDb();
  await seedSample();
  [priya, rohit, admin, support] = await Promise.all([
    loginAs(PRIYA),
    loginAs(ROHIT),
    loginAs(ADMIN),
    loginAs('support@bookleaf.com', 'Admin@123'),
  ]);
});
afterAll(stopTestDb);

describe('POST /tickets', () => {
  it('lets an author raise a General / Account Level ticket', async () => {
    const res = await createAsPriya();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'open', book: null, attachments: [] });
    expect(res.body.data.ticketNumber).toMatch(/^BL-\d{4}$/);
    for (const field of ADMIN_ONLY_FIELDS) expect(res.body.data).not.toHaveProperty(field);
  });

  it('numbers new tickets after the seeded demo tickets', async () => {
    const res = await createAsPriya();
    expect(Number(res.body.data.ticketNumber.slice(3))).toBeGreaterThan(1010);
  });

  it('links the ticket to one of the author’s own books and stores attachment metadata', async () => {
    const books = await priya.get('/api/v1/books');
    const bk001 = books.body.data[0];

    const res = await createAsPriya({
      bookId: bk001.id,
      attachments: [{ name: 'receipt.pdf', size: 12345, mimeType: 'application/pdf' }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.book).toEqual({ id: bk001.id, externalId: 'BK001', title: 'Whispers of the Ganges' });
    expect(res.body.data.attachments).toHaveLength(1);
  });

  it("rejects another author's book with a field-level 400", async () => {
    const rohitsBooks = await rohit.get('/api/v1/books');
    const res = await createAsPriya({ bookId: rohitsBooks.body.data[0].id });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.bookId');
  });

  it('validates subject and description', async () => {
    const res = await priya.post('/api/v1/tickets').send({ subject: 'Hi', description: 'too short' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.subject', 'body.description']));
  });

  it('triages instantly with the keyword fallback (visible to admins only)', async () => {
    const created = await createAsPriya({
      subject: 'Wrong ISBN on Amazon',
      description: 'The ISBN shown on Amazon is different from the one printed on my book cover.',
    });
    const detail = await admin.get(`/api/v1/tickets/${created.body.data.id}`);

    expect(detail.body.data.ticket).toMatchObject({
      category: 'isbn_metadata',
      categorySource: 'fallback',
      priority: 'high',
      prioritySource: 'fallback',
      ai: { state: 'pending' },
    });
  });

  it('is author-only and requires a session', async () => {
    expect((await admin.post('/api/v1/tickets').send({})).status).toBe(403);
    expect((await request(app).post('/api/v1/tickets').send({})).status).toBe(401);
  });
});

describe('GET /tickets', () => {
  it('shows authors only their own tickets, without internal fields', async () => {
    const res = await priya.get('/api/v1/tickets?limit=100');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const priyaId = String((await User.findOne({ email: PRIYA }).lean())!._id);
    for (const ticket of res.body.data) {
      for (const field of ADMIN_ONLY_FIELDS) expect(ticket).not.toHaveProperty(field);
    }
    // Every ticket in the admin view of Priya's list belongs to Priya.
    const adminView = await admin.get('/api/v1/tickets?limit=100');
    const priyaNumbers = adminView.body.data
      .filter((t: { author: { id: string } }) => t.author.id === priyaId)
      .map((t: TicketJson) => t.ticketNumber)
      .sort();
    expect(res.body.data.map((t: TicketJson) => t.ticketNumber).sort()).toEqual(priyaNumbers);
  });

  it('ignores admin-only filters for authors', async () => {
    const all = await priya.get('/api/v1/tickets?limit=100');
    const withPriority = await priya.get('/api/v1/tickets?limit=100&priority=critical');
    expect(withPriority.body.meta.total).toBe(all.body.meta.total);

    // ...including authorId: an author can't list someone else's tickets with it.
    const rohitId = String((await User.findOne({ email: ROHIT }).lean())!._id);
    const sneaky = await priya.get(`/api/v1/tickets?limit=100&authorId=${rohitId}`);
    expect(sneaky.body.meta.total).toBe(all.body.meta.total);
  });

  it('lets admins list one author’s tickets', async () => {
    const kavitaId = String((await User.findOne({ email: 'kavita.deshmukh@email.com' }).lean())!._id);
    const res = await admin.get(`/api/v1/tickets?authorId=${kavitaId}&sort=oldest`);
    expect(res.body.data.map((t: TicketJson) => t.ticketNumber)).toEqual(['BL-1005', 'BL-1009']);
  });

  it('sorts the admin queue by urgency: active first, then priority, then oldest', async () => {
    const res = await admin.get('/api/v1/tickets?limit=100');
    const tickets = res.body.data as (TicketJson & { isActive: boolean; priorityRank: number; createdAt: string })[];

    expect(tickets[0]!.ticketNumber).toBe('BL-1001'); // the critical, 80-hour-old royalty ticket
    const firstInactive = tickets.findIndex((t) => !t.isActive);
    expect(tickets.slice(firstInactive).every((t) => !t.isActive)).toBe(true);
    for (let i = 1; i < firstInactive; i++) {
      const [prev, cur] = [tickets[i - 1]!, tickets[i]!];
      expect(prev.priorityRank > cur.priorityRank || (prev.priorityRank === cur.priorityRank && prev.createdAt <= cur.createdAt)).toBe(true);
    }
  });

  it('flags stale tickets (no activity for 48h)', async () => {
    expect((await demoTicket('BL-1001')).isStale).toBe(true);
    expect((await demoTicket('BL-1003')).isStale).toBe(false);
  });

  it('filters by status, category, priority, assignee, search and date', async () => {
    const byStatus = await admin.get('/api/v1/tickets?status=resolved,closed');
    expect(byStatus.body.data.map((t: TicketJson) => t.status).sort()).toEqual(['closed', 'resolved']);

    const byCategory = await admin.get('/api/v1/tickets?category=isbn_metadata&status=in_progress');
    expect(byCategory.body.data.map((t: TicketJson) => t.ticketNumber)).toEqual(['BL-1002']);

    const byPriority = await admin.get('/api/v1/tickets?priority=critical');
    expect(byPriority.body.data.map((t: TicketJson) => t.ticketNumber)).toEqual(['BL-1001']);

    const mine = await support.get('/api/v1/tickets?assignee=me');
    expect(mine.body.data.map((t: TicketJson) => t.ticketNumber).sort()).toEqual(['BL-1004', 'BL-1005']);

    const unassigned = await admin.get('/api/v1/tickets?assignee=unassigned&status=open,in_progress&limit=100');
    expect(unassigned.body.data.every((t: TicketJson) => t.assignee === null)).toBe(true);

    const search = await admin.get('/api/v1/tickets?q=typesetting');
    expect(search.body.data.map((t: TicketJson) => t.ticketNumber)).toEqual(['BL-1005']);

    const future = await admin.get('/api/v1/tickets?from=2999-01-01');
    expect(future.body.meta.total).toBe(0);
  });

  it('paginates with meta', async () => {
    const res = await admin.get('/api/v1/tickets?limit=3&page=2');
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toMatchObject({ count: 3, page: 2, limit: 3 });
    expect(res.body.meta.pages).toBe(Math.ceil(res.body.meta.total / 3));
  });

  it('rejects invalid filters with 400', async () => {
    const res = await admin.get('/api/v1/tickets?status=pending&limit=500');
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    // The status path points at the offending list item ("pending" is item 0).
    expect(paths).toEqual(expect.arrayContaining(['query.status.0', 'query.limit']));
  });
});

describe('GET /tickets/:id', () => {
  it('gives the author their ticket and thread — no notes, no AI, no assignment', async () => {
    const ticket = await demoTicket('BL-1006'); // Priya's resolved general question
    const res = await priya.get(`/api/v1/tickets/${ticket.id}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['messages', 'ticket']);
    expect(res.body.data.messages).toHaveLength(2);
    expect(res.body.data.messages[0]).not.toHaveProperty('aiAssisted');
    for (const field of ADMIN_ONLY_FIELDS) expect(res.body.data.ticket).not.toHaveProperty(field);
  });

  it("returns 404 for another author's ticket", async () => {
    const rohitsTicket = await demoTicket('BL-1002');
    const res = await priya.get(`/api/v1/tickets/${rohitsTicket.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('gives admins notes and the author context', async () => {
    const ticket = await demoTicket('BL-1002');
    const res = await admin.get(`/api/v1/tickets/${ticket.id}`);

    expect(res.body.data.notes).toHaveLength(1);
    expect(res.body.data.authorContext.books.map((b: { externalId: string }) => b.externalId)).toEqual(['BK003', 'BK004']);
    expect(res.body.data.ticket.ai.classification.reasoning).toBeTruthy();
    expect(res.body.data.ticket.ai).toHaveProperty('draft');
  });

  it('400s on a malformed id', async () => {
    expect((await admin.get('/api/v1/tickets/not-an-id')).status).toBe(400);
  });
});

describe('PATCH /tickets/:id (admin)', () => {
  it('is admin-only', async () => {
    const own = (await createAsPriya()).body.data;
    expect((await priya.patch(`/api/v1/tickets/${own.id}`).send({ status: 'closed' })).status).toBe(403);
  });

  it('changes status and tracks resolution time', async () => {
    const { id } = (await createAsPriya()).body.data;

    const resolved = await admin.patch(`/api/v1/tickets/${id}`).send({ status: 'resolved' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toMatchObject({ status: 'resolved', isActive: false });
    expect(resolved.body.data.resolvedAt).not.toBeNull();

    const reopened = await admin.patch(`/api/v1/tickets/${id}`).send({ status: 'in_progress' });
    expect(reopened.body.data).toMatchObject({ status: 'in_progress', isActive: true, resolvedAt: null });
  });

  it('records category and priority overrides as admin decisions', async () => {
    const { id } = (await createAsPriya()).body.data;
    const res = await admin.patch(`/api/v1/tickets/${id}`).send({ category: 'royalty_payments', priority: 'critical' });

    expect(res.body.data).toMatchObject({
      category: 'royalty_payments',
      categorySource: 'admin',
      priority: 'critical',
      priorityRank: 4,
      prioritySource: 'admin',
    });
  });

  it('assigns to an admin, refuses non-admins, and unassigns', async () => {
    const { id } = (await createAsPriya()).body.data;
    const me = (await admin.get('/api/v1/auth/me')).body.data.user;
    const priyaUser = (await priya.get('/api/v1/auth/me')).body.data.user;

    const assigned = await admin.patch(`/api/v1/tickets/${id}`).send({ assigneeId: me.id });
    expect(assigned.body.data.assignee).toEqual({ id: me.id, name: me.name });

    const toAuthor = await admin.patch(`/api/v1/tickets/${id}`).send({ assigneeId: priyaUser.id });
    expect(toAuthor.status).toBe(400);
    expect(toAuthor.body.error.details[0].path).toBe('body.assigneeId');

    const unassigned = await admin.patch(`/api/v1/tickets/${id}`).send({ assigneeId: null });
    expect(unassigned.body.data.assignee).toBeNull();
  });

  it('rejects an empty or unknown patch', async () => {
    const { id } = (await createAsPriya()).body.data;
    expect((await admin.patch(`/api/v1/tickets/${id}`).send({})).status).toBe(400);
    expect((await admin.patch(`/api/v1/tickets/${id}`).send({ subject: 'hacked' })).status).toBe(400);
  });
});

describe('replies and internal notes', () => {
  it('moves a new ticket to In Progress when an admin replies, and the author sees the reply', async () => {
    const { id } = (await createAsPriya()).body.data;

    const reply = await admin.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Hi Priya, happy to help.', aiAssisted: true });
    expect(reply.status).toBe(201);
    expect(reply.body.data).toMatchObject({ senderRole: 'admin', aiAssisted: true });

    const detail = await priya.get(`/api/v1/tickets/${id}`);
    expect(detail.body.data.ticket).toMatchObject({ status: 'in_progress', lastReplyRole: 'admin' });
    expect(detail.body.data.messages.at(-1).body).toBe('Hi Priya, happy to help.');
  });

  it('reopens a resolved ticket when the author replies', async () => {
    const { id } = (await createAsPriya()).body.data;
    await admin.patch(`/api/v1/tickets/${id}`).send({ status: 'resolved' });

    const res = await priya.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Sorry, one more question.' });
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('aiAssisted');
    expect((await priya.get(`/api/v1/tickets/${id}`)).body.data.ticket.status).toBe('open');
  });

  it('refuses replies on closed tickets', async () => {
    const { id } = (await createAsPriya()).body.data;
    await admin.patch(`/api/v1/tickets/${id}`).send({ status: 'closed' });

    const res = await priya.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Hello?' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_CLOSED');
  });

  it("blocks replies to another author's ticket", async () => {
    const rohitsTicket = await demoTicket('BL-1002');
    expect((await priya.post(`/api/v1/tickets/${rohitsTicket.id}/messages`).send({ body: 'hi' })).status).toBe(404);
  });

  it('keeps internal notes away from authors', async () => {
    const { id } = (await createAsPriya()).body.data;
    const secret = 'Internal: author has a history of chargebacks';

    expect((await priya.post(`/api/v1/tickets/${id}/notes`).send({ body: 'sneaky' })).status).toBe(403);
    const note = await admin.post(`/api/v1/tickets/${id}/notes`).send({ body: secret });
    expect(note.status).toBe(201);
    expect(note.body.data.admin.name).toMatch(/Aisha/);

    const authorView = await priya.get(`/api/v1/tickets/${id}`);
    expect(JSON.stringify(authorView.body)).not.toContain(secret);
    const adminView = await admin.get(`/api/v1/tickets/${id}`);
    expect(adminView.body.data.notes.map((n: { body: string }) => n.body)).toContain(secret);
  });
});

describe('GET /tickets/stats', () => {
  it('summarises the queue for admins', async () => {
    const res = await support.get('/api/v1/tickets/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.activeByPriority.critical).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeStale).toBeGreaterThanOrEqual(1);
    expect(res.body.data.assignedToMe).toBe(2); // BL-1004, BL-1005
    expect(res.body.data.byStatus.closed).toBeGreaterThanOrEqual(1);
  });

  it('is admin-only', async () => {
    expect((await priya.get('/api/v1/tickets/stats')).status).toBe(403);
  });
});

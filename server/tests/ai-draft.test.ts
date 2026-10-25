import request from 'supertest';
import { settleBackgroundJobs } from '../src/lib/background';
import { setAiProvider } from '../src/modules/ai/provider-registry';
import { FakeAiProvider } from './fake-ai';
import { ADMIN, app, loginAs, PRIYA, ROHIT, seedSample, startTestDb, stopTestDb } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;

let priya: Agent;
let rohit: Agent;
let admin: Agent;
let fake: FakeAiProvider;
let bk001: string;

const DRAFT = 'Hi Priya,\n\nThank you for reaching out about your royalty...\n\nWarm regards,\nBookLeaf Author Support';

async function createRoyaltyTicket(): Promise<string> {
  const res = await priya.post('/api/v1/tickets').send({
    bookId: bk001,
    subject: 'Royalty for last quarter not received',
    description: 'I was expecting a royalty payout for Whispers of the Ganges but nothing has arrived in my bank account.',
  });
  expect(res.status).toBe(201);
  await settleBackgroundJobs(); // background classification (fails: nothing scripted) shouldn't race the test
  return res.body.data.id as string;
}

const draftUrl = (id: string) => `/api/v1/tickets/${id}/ai-draft`;
const adminDetail = async (id: string) => (await admin.get(`/api/v1/tickets/${id}`)).body.data;

beforeAll(async () => {
  await startTestDb();
  await seedSample();
  [priya, rohit, admin] = await Promise.all([loginAs(PRIYA), loginAs(ROHIT), loginAs(ADMIN)]);
  bk001 = (await priya.get('/api/v1/books')).body.data.find((b: { externalId: string }) => b.externalId === 'BK001').id;
});
beforeEach(() => {
  fake = new FakeAiProvider();
  setAiProvider(fake);
});
afterEach(async () => {
  await settleBackgroundJobs();
  setAiProvider(undefined);
});
afterAll(stopTestDb);

describe('GET /tickets/:id/ai-draft: access', () => {
  it('is admin-only, validates the id and 404s unknown tickets', async () => {
    const id = await createRoyaltyTicket();

    const anon = await request(app).get(draftUrl(id));
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('UNAUTHENTICATED');
    // Even the ticket's own author can't see drafts.
    const author = await priya.get(draftUrl(id));
    expect(author.status).toBe(403);
    expect(author.body.error.code).toBe('FORBIDDEN');
    expect((await rohit.post(draftUrl(id))).status).toBe(403);

    const bad = await admin.get(draftUrl('not-an-id'));
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect((await admin.get(draftUrl('0123456789abcdef01234567'))).status).toBe(404);

    expect(fake.callsFor('draft')).toHaveLength(0);
  });
});

describe('drafting a reply', () => {
  it('generates a KB-grounded draft on first open, then serves it from cache', async () => {
    const id = await createRoyaltyTicket();
    fake.reply('draft', DRAFT);

    const first = await admin.get(draftUrl(id));
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ body: DRAFT, model: 'fake-openai/gpt-oss-120b' });
    expect(first.body.meta).toEqual({ cached: false });

    const second = await admin.get(draftUrl(id));
    expect(second.body).toMatchObject({ data: { body: DRAFT }, meta: { cached: true } });
    expect(fake.callsFor('draft')).toHaveLength(1);

    // The admin ticket view carries the cached draft so the composer can pre-fill instantly.
    expect((await adminDetail(id)).ticket.ai.draft).toMatchObject({ body: DRAFT });
  });

  it('sends only the relevant policy, the book fact sheet and the tone rules to the large model', async () => {
    const id = await createRoyaltyTicket();
    fake.reply('draft', DRAFT);
    await admin.get(draftUrl(id)).expect(200);

    const [call] = fake.callsFor('draft');
    expect(call).toMatchObject({ model: 'openai/gpt-oss-120b', temperature: 0.4, maxTokens: 800 });
    expect(call?.system).toContain('Communication Tone Guidelines');
    expect(call?.user).toContain('## Royalty Policy');
    expect(call?.user).toContain('paid within 45 days of the quarter ending');
    expect(call?.user).toContain('Whispers of the Ganges');
    expect(call?.user).toContain('pending ₹3,570');
    // Seed: BK001 last paid 2025-10-15 with ₹3,570 payable, so BookLeaf is behind.
    expect(call?.user).toContain('Payout status: behind schedule');
    expect(call?.user).toContain('Author first name: Priya');
    expect(call?.user).not.toContain('ISBN Policy');
    expect(call?.user).not.toContain('Printing & Quality');
  });

  it('regenerates on POST and replaces the cache', async () => {
    const id = await createRoyaltyTicket();
    fake.reply('draft', DRAFT).reply('draft', 'Second version');

    await admin.get(draftUrl(id)).expect(200);
    const regenerated = await admin.post(draftUrl(id));
    expect(regenerated.status).toBe(200);
    expect(regenerated.body).toMatchObject({ data: { body: 'Second version' }, meta: { cached: false } });

    expect((await admin.get(draftUrl(id))).body).toMatchObject({ data: { body: 'Second version' }, meta: { cached: true } });
    expect(fake.callsFor('draft')).toHaveLength(2);
  });

  it('invalidates the draft when the author replies, and drafts against the new message', async () => {
    const id = await createRoyaltyTicket();
    fake.reply('draft', DRAFT).reply('draft', 'Updated answer');
    await admin.get(draftUrl(id)).expect(200);

    await priya.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Also, my bank details changed last month.' }).expect(201);
    expect((await adminDetail(id)).ticket.ai.draft).toBeNull();

    const fresh = await admin.get(draftUrl(id));
    expect(fresh.body).toMatchObject({ data: { body: 'Updated answer' }, meta: { cached: false } });
    expect(fake.callsFor('draft')[1]?.user).toContain('my bank details changed last month');
  });

  it('coalesces concurrent first opens into one model call', async () => {
    const id = await createRoyaltyTicket();
    const release = fake.hold('draft', DRAFT);

    const both = Promise.all([admin.get(draftUrl(id)), admin.get(draftUrl(id))]);
    while (fake.callsFor('draft').length === 0) await new Promise((r) => setTimeout(r, 10));
    release();

    const [a, b] = await both;
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.data.body).toBe(DRAFT);
    expect(b.body.data.body).toBe(DRAFT);
    expect(fake.callsFor('draft')).toHaveLength(1);
  });

  it("doesn't cache a draft that went stale while it was being generated", async () => {
    const id = await createRoyaltyTicket();
    const release = fake.hold('draft', DRAFT);

    const pending = admin.get(draftUrl(id)).then((r) => r);
    // Give the request time to reach the provider, then let the author reply mid-generation.
    while (fake.callsFor('draft').length === 0) await new Promise((r) => setTimeout(r, 10));
    await priya.post(`/api/v1/tickets/${id}/messages`).send({ body: 'One more detail…' }).expect(201);
    release();

    expect((await pending).status).toBe(200);
    expect((await adminDetail(id)).ticket.ai.draft).toBeNull();
  });

  it('refuses to draft for a closed ticket', async () => {
    const id = await createRoyaltyTicket();
    await admin.patch(`/api/v1/tickets/${id}`).send({ status: 'closed' }).expect(200);

    const res = await admin.post(draftUrl(id));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_CLOSED');
    expect(fake.callsFor('draft')).toHaveLength(0);
  });
});

describe('when the AI is unavailable', () => {
  it.each([
    ['times out', () => fake.fail('draft', 'timeout')],
    ['is rate-limited', () => fake.fail('draft', 'rate_limited')],
    ['is not configured', () => setAiProvider(null)],
  ])('returns 503 AI_UNAVAILABLE when the provider %s, and manual replies still work', async (_label, script) => {
    const id = await createRoyaltyTicket();
    script();

    const res = await admin.get(draftUrl(id));
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'AI_UNAVAILABLE', message: expect.stringContaining('manually') });
    expect((await adminDetail(id)).ticket.ai.draft).toBeNull();

    const manual = await admin.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Hi Priya, checking this now.' });
    expect(manual.status).toBe(201);
    expect(manual.body.data.aiAssisted).toBe(false);
  });
});

describe('sending an edited draft', () => {
  it('records AI assistance for admins only and never exposes AI data to the author', async () => {
    const id = await createRoyaltyTicket();
    fake.reply('draft', DRAFT);
    await admin.get(draftUrl(id)).expect(200);

    const sent = await admin
      .post(`/api/v1/tickets/${id}/messages`)
      .send({ body: `${DRAFT}\n\nP.S. Edited by the team.`, aiAssisted: true });
    expect(sent.status).toBe(201);
    expect(sent.body.data.aiAssisted).toBe(true);

    // The used draft is cleared so the next reply starts fresh.
    const detail = await adminDetail(id);
    expect(detail.ticket.ai.draft).toBeNull();
    expect(detail.ticket.status).toBe('in_progress');

    const authorView = (await priya.get(`/api/v1/tickets/${id}`)).body.data;
    expect(authorView.ticket).not.toHaveProperty('ai');
    expect(authorView.messages.at(-1)).toMatchObject({ body: expect.stringContaining('Edited by the team') });
    expect(authorView.messages.at(-1)).not.toHaveProperty('aiAssisted');
  });

  it('ignores aiAssisted from authors', async () => {
    const id = await createRoyaltyTicket();
    await priya.post(`/api/v1/tickets/${id}/messages`).send({ body: 'Following up', aiAssisted: true }).expect(201);

    const messages = (await adminDetail(id)).messages as { body: string; aiAssisted: boolean }[];
    expect(messages.at(-1)).toMatchObject({ body: 'Following up', aiAssisted: false });
  });
});

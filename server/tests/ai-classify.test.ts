import request from 'supertest';
import { settleBackgroundJobs } from '../src/lib/background';
import { setAiProvider } from '../src/modules/ai/provider-registry';
import { FakeAiProvider } from './fake-ai';
import { ADMIN, app, loginAs, PRIYA, seedSample, startTestDb, stopTestDb } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;

let priya: Agent;
let admin: Agent;
let fake: FakeAiProvider;

const ROYALTY_TICKET = {
  bookId: null,
  subject: 'Where is my royalty?',
  description: 'My book went live six months ago and I have not been paid any royalty yet.',
};

async function createTicket(body: Record<string, unknown> = ROYALTY_TICKET): Promise<string> {
  const res = await priya.post('/api/v1/tickets').send(body);
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function adminView(id: string) {
  return (await admin.get(`/api/v1/tickets/${id}`)).body.data.ticket;
}

beforeAll(async () => {
  await startTestDb();
  await seedSample();
  [priya, admin] = await Promise.all([loginAs(PRIYA), loginAs(ADMIN)]);
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

describe('background AI classification', () => {
  it('replaces the keyword triage with the AI verdict and keeps the raw classification', async () => {
    fake.reply('classify', {
      category: 'royalty_payments',
      priority: 'critical',
      reasoning: 'No royalty six months after publication is more than a quarter overdue.',
    });
    const id = await createTicket();
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({
      category: 'royalty_payments',
      categorySource: 'ai',
      priority: 'critical',
      priorityRank: 4,
      prioritySource: 'ai',
      ai: {
        state: 'done',
        error: null,
        classification: {
          category: 'royalty_payments',
          priority: 'critical',
          reasoning: expect.stringContaining('quarter'),
          model: 'fake-openai/gpt-oss-20b',
        },
      },
    });
  });

  it('uses the small model, temperature 0 and only the ticket text (no knowledge base)', async () => {
    fake.reply('classify', { category: 'royalty_payments', priority: 'high', reasoning: 'Royalty not received.' });
    await createTicket();
    await settleBackgroundJobs();

    const [call] = fake.callsFor('classify');
    expect(call).toMatchObject({ model: 'openai/gpt-oss-20b', temperature: 0, maxTokens: 200 });
    expect(call?.user).toContain('<ticket>');
    expect(call?.user).toContain(ROYALTY_TICKET.description);
    expect(call?.user).not.toContain('Royalty Policy');
  });

  it('answers 201 straight away while the model is still thinking', async () => {
    const release = fake.hold('classify', { category: 'royalty_payments', priority: 'high', reasoning: 'Royalty question.' });
    const id = await createTicket();

    expect(await adminView(id)).toMatchObject({ categorySource: 'fallback', ai: { state: 'pending' } });

    release();
    await settleBackgroundJobs();
    expect(await adminView(id)).toMatchObject({ categorySource: 'ai', ai: { state: 'done' } });
  });

  it('never overwrites an admin override made while the model was thinking', async () => {
    const release = fake.hold('classify', { category: 'general_inquiry', priority: 'low', reasoning: 'Looks like a question.' });
    const id = await createTicket();
    await admin.patch(`/api/v1/tickets/${id}`).send({ priority: 'high' }).expect(200);

    release();
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({
      priority: 'high',
      prioritySource: 'admin',
      // Category wasn't overridden, so the AI verdict applies there.
      category: 'general_inquiry',
      categorySource: 'ai',
      ai: { state: 'done', classification: { priority: 'low' } },
    });
  });

  it('enforces the KB policy that ISBN errors are at least High', async () => {
    fake.reply('classify', { category: 'isbn_metadata', priority: 'low', reasoning: 'ISBN mismatch.' });
    const id = await createTicket({
      bookId: null,
      subject: 'ISBN mismatch',
      description: 'Amazon shows a different ISBN than the one printed on my book.',
    });
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({ priority: 'high', ai: { classification: { priority: 'high' } } });
  });

  it('accepts the human-readable labels a model sometimes echoes back', async () => {
    fake.reply('classify', { category: 'Printing & Quality', priority: 'High', reasoning: 'Blurry print.' });
    const id = await createTicket();
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({ category: 'printing_quality', priority: 'high' });
  });

  it.each([
    ['output outside the allowed enums', () => fake.reply('classify', { category: 'refunds', priority: 'urgent', reasoning: 'x' }), 'The AI returned an unusable answer'],
    ['a malformed JSON shape', () => fake.reply('classify', 'definitely not json'), 'The AI returned an unusable answer'],
    ['a timeout', () => fake.fail('classify', 'timeout'), 'The AI service timed out'],
    ['rate limiting', () => fake.fail('classify', 'rate_limited'), 'The AI service is rate-limited right now'],
    ['an upstream error', () => fake.fail('classify', 'upstream'), 'The AI service returned an error'],
  ])('keeps the keyword triage on %s', async (_label, script, error) => {
    script();
    const id = await createTicket();
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({
      category: 'royalty_payments',
      categorySource: 'fallback',
      prioritySource: 'fallback',
      ai: { state: 'failed', error, classification: null },
    });
  });

  it('still creates tickets when no API key is configured', async () => {
    setAiProvider(null);
    const id = await createTicket();
    await settleBackgroundJobs();

    expect(await adminView(id)).toMatchObject({
      categorySource: 'fallback',
      ai: { state: 'failed', error: 'AI is not configured on this server' },
    });
  });
});

describe('POST /tickets/:id/classify', () => {
  it('requires an admin session, a valid id and an existing ticket', async () => {
    fake.fail('classify', 'upstream');
    const id = await createTicket();
    await settleBackgroundJobs();

    expect((await request(app).post(`/api/v1/tickets/${id}/classify`)).status).toBe(401);
    expect((await priya.post(`/api/v1/tickets/${id}/classify`)).status).toBe(403);
    expect((await admin.post('/api/v1/tickets/not-an-id/classify')).status).toBe(400);
    const missing = await admin.post('/api/v1/tickets/0123456789abcdef01234567/classify');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(fake.callsFor('classify')).toHaveLength(1); // only the background attempt
  });

  it('re-runs a failed classification on demand', async () => {
    fake.fail('classify', 'timeout');
    const id = await createTicket();
    await settleBackgroundJobs();

    fake.reply('classify', { category: 'royalty_payments', priority: 'critical', reasoning: 'Overdue royalty.' });
    const res = await admin.post(`/api/v1/tickets/${id}/classify`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ prioritySource: 'ai', priority: 'critical', ai: { state: 'done', error: null } });
  });

  it('returns 503 AI_UNAVAILABLE when the AI is still down, leaving the triage intact', async () => {
    fake.fail('classify', 'timeout').fail('classify', 'rate_limited');
    const id = await createTicket();
    await settleBackgroundJobs();

    const res = await admin.post(`/api/v1/tickets/${id}/classify`);
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'AI_UNAVAILABLE', message: expect.stringContaining('keyword triage') });
    expect(await adminView(id)).toMatchObject({ categorySource: 'fallback', ai: { state: 'failed' } });
  });
});

import request from 'supertest';
import { User } from '../src/modules/users/user.model';
import { ADMIN, app, loginAs, PRIYA, ROHIT, seedSample, startTestDb, stopTestDb } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;

let priya: Agent;
let admin: Agent;
let rohitId: string;

beforeAll(async () => {
  await startTestDb();
  await seedSample();
  [priya, admin] = await Promise.all([loginAs(PRIYA), loginAs(ADMIN)]);
  rohitId = String((await User.findOne({ email: ROHIT }).lean())!._id);
});
afterAll(stopTestDb);

describe('unauthenticated access', () => {
  it.each(['/api/v1/books', '/api/v1/books/BK001', '/api/v1/authors', '/api/v1/admins', '/api/v1/auth/me'])(
    '%s → 401',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    },
  );

  it('public health check stays open', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});

describe('author scope', () => {
  it('sees only their own books', async () => {
    const res = await priya.get('/api/v1/books');

    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { externalId: string }) => b.externalId)).toEqual(['BK001', 'BK002']);
    expect(res.body.meta.count).toBe(2);
  });

  it('cannot widen their scope with ?authorId=', async () => {
    const res = await priya.get(`/api/v1/books?authorId=${rohitId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { externalId: string }) => b.externalId)).toEqual(['BK001', 'BK002']);
  });

  it('can read their own book by dataset id', async () => {
    const res = await priya.get('/api/v1/books/BK001');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Whispers of the Ganges', royalty: { pending: 3570 } });
  });

  it("gets 404 (not 403) for another author's book — by dataset id and by ObjectId", async () => {
    const byExternalId = await priya.get('/api/v1/books/BK003');
    expect(byExternalId.status).toBe(404);
    expect(byExternalId.body.error.code).toBe('NOT_FOUND');

    const rohitsBook = await admin.get('/api/v1/books/BK003');
    const byObjectId = await priya.get(`/api/v1/books/${rohitsBook.body.data.id}`);
    expect(byObjectId.status).toBe(404);
  });

  it.each(['/api/v1/authors', '/api/v1/admins'])('gets 403 on admin-only endpoint %s', async (path) => {
    const res = await priya.get(path);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('admin scope', () => {
  it('sees all 18 books', async () => {
    const res = await admin.get('/api/v1/books');
    expect(res.status).toBe(200);
    expect(res.body.meta.count).toBe(18);
  });

  it('can filter books by author', async () => {
    const res = await admin.get(`/api/v1/books?authorId=${rohitId}`);
    expect(res.body.data.map((b: { externalId: string }) => b.externalId)).toEqual(['BK003', 'BK004']);
  });

  it('can read any book', async () => {
    expect((await admin.get('/api/v1/books/BK013')).status).toBe(200);
  });

  it('lists all 10 authors with aggregated stats', async () => {
    const res = await admin.get('/api/v1/authors');

    expect(res.status).toBe(200);
    expect(res.body.meta.count).toBe(10);
    const sneha = res.body.data.find((a: { email: string }) => a.email === 'sneha.kulkarni@email.com');
    expect(sneha.stats).toMatchObject({ books: 3, published: 2, inProduction: 1 });
    const priyaRow = res.body.data.find((a: { email: string }) => a.email === PRIYA);
    expect(priyaRow.stats).toMatchObject({
      copiesSold: 531,
      royaltyEarned: 19908,
      royaltyPaid: 16338,
      royaltyPending: 3570,
    });
  });
});

describe('admin directory', () => {
  it('lists the support team by name, without emails or password hashes', async () => {
    const res = await admin.get('/api/v1/admins');

    expect(res.status).toBe(200);
    expect(res.body.meta.count).toBe(2);
    expect(res.body.data.map((a: { name: string }) => a.name)).toEqual([
      'Aisha Verma (Support Lead)',
      'Rahul Mehta (Support Agent)',
    ]);
    for (const row of res.body.data) expect(Object.keys(row).sort()).toEqual(['id', 'name']);
  });
});

describe('input validation on protected routes', () => {
  it('rejects a malformed book id with 400', async () => {
    const res = await priya.get('/api/v1/books/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed authorId filter with 400', async () => {
    const res = await admin.get('/api/v1/books?authorId=123');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('query.authorId');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await admin.get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

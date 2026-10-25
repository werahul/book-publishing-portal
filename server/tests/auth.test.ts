import jwt from 'jsonwebtoken';
import request from 'supertest';
import { SESSION_COOKIE_NAME } from '@bookleaf/shared';
import { JWT_ISSUER, SESSION_AUDIENCE } from '../src/lib/jwt';
import { User } from '../src/modules/users/user.model';
import {
  ADMIN,
  ADMIN_PASSWORD,
  app,
  AUTHOR_PASSWORD,
  loginAs,
  PRIYA,
  seedSample,
  startTestDb,
  stopTestDb,
} from './helpers';

const LOGIN = '/api/v1/auth/login';
const ME = '/api/v1/auth/me';

function sessionCookie(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
}

beforeAll(async () => {
  await startTestDb();
  await seedSample();
});
afterAll(stopTestDb);

describe('POST /auth/login', () => {
  it('logs in and sets an httpOnly, SameSite=Lax session cookie', async () => {
    const res = await request(app).post(LOGIN).send({ email: PRIYA, password: AUTHOR_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      email: PRIYA,
      name: 'Priya Sharma',
      role: 'author',
      authorProfile: { externalId: 'AUTH001', city: 'Mumbai' },
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });

  it('treats email case-insensitively and trims whitespace', async () => {
    const res = await request(app)
      .post(LOGIN)
      .send({ email: '  Priya.Sharma@EMAIL.com ', password: AUTHOR_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app).post(LOGIN).send({ email: PRIYA, password: 'nope' });
    const unknownEmail = await request(app)
      .post(LOGIN)
      .send({ email: 'nobody@email.com', password: AUTHOR_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(sessionCookie(wrongPassword)).toBeUndefined();
  });

  it('returns 400 with field-level details for an invalid body', async () => {
    const res = await request(app).post(LOGIN).send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(app)
      .post(LOGIN)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('POST /auth/login with a portal (sign-in tab)', () => {
  it('signs in when the portal matches the role', async () => {
    const author = await request(app).post(LOGIN).send({ email: PRIYA, password: AUTHOR_PASSWORD, portal: 'author' });
    const admin = await request(app).post(LOGIN).send({ email: ADMIN, password: ADMIN_PASSWORD, portal: 'admin' });

    expect(author.status).toBe(200);
    expect(admin.status).toBe(200);
    expect(admin.body.data.user.role).toBe('admin');
    expect(sessionCookie(admin)).toBeDefined();
  });

  it('rejects an author on the team tab with 403 WRONG_PORTAL and sets no cookie', async () => {
    const res = await request(app).post(LOGIN).send({ email: PRIYA, password: AUTHOR_PASSWORD, portal: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_PORTAL');
    expect(res.body.error.message).toMatch(/Author sign-in/);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('rejects an admin on the author tab with 403 WRONG_PORTAL', async () => {
    const res = await request(app).post(LOGIN).send({ email: ADMIN, password: ADMIN_PASSWORD, portal: 'author' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/BookLeaf Team sign-in/);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('still answers a wrong password with the generic 401, so the tab leaks no account details', async () => {
    const res = await request(app).post(LOGIN).send({ email: ADMIN, password: 'nope', portal: 'author' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown portal value with 400', async () => {
    const res = await request(app).post(LOGIN).send({ email: PRIYA, password: AUTHOR_PASSWORD, portal: 'superuser' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.portal');
  });
});

describe('GET /auth/me', () => {
  it('returns the current user for a valid session', async () => {
    const agent = await loginAs(PRIYA);
    const res = await agent.get(ME);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(PRIYA);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).get(ME);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for a tampered token (role escalated, signature kept)', async () => {
    const login = await request(app).post(LOGIN).send({ email: PRIYA, password: AUTHOR_PASSWORD });
    const token = sessionCookie(login)!.split(';')[0]!.split('=')[1]!;
    const [header, payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), role: 'admin' }),
    ).toString('base64url');

    const res = await request(app)
      .get(ME)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${header}.${forged}.${signature}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const user = await User.findOne({ email: PRIYA }).lean();
    const token = jwt.sign({ role: 'author' }, 'some-other-secret-that-is-also-long-enough', {
      subject: String(user!._id),
      issuer: JWT_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const res = await request(app).get(ME).set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const user = await User.findOne({ email: PRIYA }).lean();
    const token = jwt.sign(
      { role: 'author', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
      { subject: String(user!._id), issuer: JWT_ISSUER, audience: SESSION_AUDIENCE },
    );
    const res = await request(app).get(ME).set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 once the user has been deleted, even with a valid token', async () => {
    const agent = await loginAs(PRIYA);
    await User.deleteOne({ email: PRIYA });

    const res = await agent.get(ME);
    expect(res.status).toBe(401);

    await seedSample({ reset: false }); // restore Priya for other tests
  });
});

describe('POST /auth/logout', () => {
  it('clears the session cookie so subsequent requests are unauthenticated', async () => {
    const agent = await loginAs(PRIYA);
    expect((await agent.get(ME)).status).toBe(200);

    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect((await agent.get(ME)).status).toBe(401);
  });

  it('is idempotent without a session', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});

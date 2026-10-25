import request from 'supertest';
import { app, startTestDb, stopTestDb } from './helpers';

afterAll(stopTestDb);

describe('GET /health', () => {
  it('returns 503 while the database is unreachable', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 200 with db "up" once connected', async () => {
    await startTestDb();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', db: 'up' });
  });
});

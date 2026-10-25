import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, type SocketEvent, type TicketEventPayload } from '@bookleaf/shared';
import { settleBackgroundJobs } from '../src/lib/background';
import { signSessionToken } from '../src/lib/jwt';
import { closeRealtime, initRealtime } from '../src/realtime/realtime';
import { ADMIN, app, loginAs, PRIYA, ROHIT, seedSample, startTestDb, stopTestDb } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;

let server: http.Server;
let url: string;
let priya: Agent;
let rohit: Agent;
let admin: Agent;
const sockets: Socket[] = [];

function openSocket(token?: string): Promise<Socket> {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function socketFor(agent: Agent): Promise<Socket> {
  const res = await agent.get('/api/v1/auth/socket-token').expect(200);
  return openSocket(res.body.data.token);
}

function nextEvent(socket: Socket, event: SocketEvent, timeoutMs = 3000): Promise<TicketEventPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${timeoutMs}ms`)), timeoutMs);
    socket.once(event, (payload: TicketEventPayload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Records every ticket event a socket receives from now on. */
function recorder(socket: Socket) {
  const seen: { event: string; payload: TicketEventPayload }[] = [];
  for (const event of Object.values(SOCKET_EVENTS)) socket.on(event, (payload) => seen.push({ event, payload }));
  return seen;
}

const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));

/** Create a ticket as Priya and wait until its background AI pass (and its events) are done. */
async function createQuietTicket(): Promise<{ id: string; ticketNumber: string }> {
  const res = await priya.post('/api/v1/tickets').send({
    bookId: null,
    subject: 'Dashboard question',
    description: 'Where can I see my sales split by platform on the dashboard?',
  });
  await settleBackgroundJobs();
  await tick();
  return res.body.data;
}

beforeAll(async () => {
  await startTestDb();
  await seedSample();
  server = http.createServer(app);
  initRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  [priya, rohit, admin] = await Promise.all([loginAs(PRIYA), loginAs(ROHIT), loginAs(ADMIN)]);
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await closeRealtime();
  await stopTestDb();
});

describe('GET /auth/socket-token', () => {
  it('requires a session', async () => {
    const res = await request(app).get('/api/v1/auth/socket-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns a short-lived token and the socket URL, uncached', async () => {
    const res = await priya.get('/api/v1/auth/socket-token');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({ token: expect.any(String), url: 'http://localhost:4000', expiresIn: 60 });
  });

  it('issues tokens that cannot be used as a session cookie', async () => {
    const token = (await priya.get('/api/v1/auth/socket-token')).body.data.token;
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `bl_token=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('socket handshake', () => {
  it.each([
    ['no token', undefined],
    ['a garbage token', 'not-a-jwt'],
    ['a session token instead of a socket token', signSessionToken({ userId: '0123456789abcdef01234567', role: 'admin' })],
  ])('rejects %s', async (_label, token) => {
    await expect(openSocket(token)).rejects.toMatchObject({ message: 'UNAUTHENTICATED' });
  });

  it('accepts a fresh socket token', async () => {
    const socket = await socketFor(priya);
    expect(socket.connected).toBe(true);
  });
});

describe('ticket events', () => {
  it('tells the author and admins about a reply, but not other authors', async () => {
    const [priyaSocket, rohitSocket, adminSocket] = await Promise.all([socketFor(priya), socketFor(rohit), socketFor(admin)]);
    const ticket = await createQuietTicket();
    const rohitSeen = recorder(rohitSocket);

    const priyaGets = nextEvent(priyaSocket, SOCKET_EVENTS.ticketMessage);
    const adminGets = nextEvent(adminSocket, SOCKET_EVENTS.ticketMessage);
    await admin.post(`/api/v1/tickets/${ticket.id}/messages`).send({ body: 'Hi Priya, here is how…' }).expect(201);

    // Invalidation only: ids, never ticket content.
    expect(await priyaGets).toEqual({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    expect(await adminGets).toEqual({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    await tick();
    expect(rohitSeen).toEqual([]);
  });

  it('tells the author when an admin changes the status', async () => {
    const priyaSocket = await socketFor(priya);
    const ticket = await createQuietTicket();

    const update = nextEvent(priyaSocket, SOCKET_EVENTS.ticketUpdated);
    await admin.patch(`/api/v1/tickets/${ticket.id}`).send({ status: 'resolved' }).expect(200);
    expect(await update).toMatchObject({ ticketId: ticket.id });
  });

  it('tells admins about new tickets and their AI triage', async () => {
    const adminSocket = await socketFor(admin);
    const seen = recorder(adminSocket);

    const res = await priya.post('/api/v1/tickets').send({
      bookId: null,
      subject: 'Bio update request',
      description: 'Could you update the author bio shown on my book page please?',
    });
    await settleBackgroundJobs();
    await tick();

    // One event on creation, one when the (here: failing, no key) AI pass finishes.
    const forTicket = seen.filter((e) => e.payload.ticketId === res.body.data.id);
    expect(forTicket.map((e) => e.event)).toEqual([SOCKET_EVENTS.ticketUpdated, SOCKET_EVENTS.ticketUpdated]);
  });

  it('keeps internal notes to the admins room', async () => {
    const [priyaSocket, adminSocket] = await Promise.all([socketFor(priya), socketFor(admin)]);
    const ticket = await createQuietTicket();
    const priyaSeen = recorder(priyaSocket);

    const adminGets = nextEvent(adminSocket, SOCKET_EVENTS.ticketUpdated);
    await admin.post(`/api/v1/tickets/${ticket.id}/notes`).send({ body: 'Check bank details first.' }).expect(201);

    expect(await adminGets).toMatchObject({ ticketId: ticket.id });
    await tick();
    expect(priyaSeen).toEqual([]);
  });
});

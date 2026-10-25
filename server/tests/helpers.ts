import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { settleBackgroundJobs } from '../src/lib/background';
import { seedDatabase } from '../src/seed/seed';

export const AUTHOR_PASSWORD = 'Author@123';
export const ADMIN_PASSWORD = 'Admin@123';

export const PRIYA = 'priya.sharma@email.com'; // AUTH001 — BK001, BK002
export const ROHIT = 'rohit.kapoor@email.com'; // AUTH002 — BK003, BK004
export const ADMIN = 'admin@bookleaf.com';

const silentLogger = { log: () => undefined, warn: () => undefined };

let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDb(): Promise<void> {
  // Ticket creation starts background AI jobs; let them finish before the DB goes away.
  await settleBackgroundJobs();
  await mongoose.disconnect();
  await mongod?.stop();
}

export function seedSample(options: { reset?: boolean } = { reset: true }) {
  return seedDatabase({
    reset: options.reset,
    authorPassword: AUTHOR_PASSWORD,
    adminPassword: ADMIN_PASSWORD,
    logger: silentLogger,
  });
}

export const app = createApp();

/** A Supertest agent that keeps the session cookie between requests. */
export async function loginAs(email: string, password = email === ADMIN ? ADMIN_PASSWORD : AUTHOR_PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  return agent;
}

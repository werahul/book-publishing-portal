import http from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDb();
  console.log('[db] connected');

  // A plain http.Server (not app.listen) so Socket.IO can attach to it in the Real-time phase.
  const server = http.createServer(createApp());
  server.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});

import http from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { settleBackgroundJobs } from './lib/background';
import { closeRealtime, initRealtime } from './realtime/realtime';

async function main() {
  await connectDb();
  console.log('[db] connected');

  // A plain http.Server (not app.listen) so Socket.IO shares the port with the REST API.
  const server = http.createServer(createApp());
  initRealtime(server);
  server.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    // Closing Socket.IO also closes the HTTP server; let in-flight AI jobs write their results first.
    void closeRealtime()
      .then(settleBackgroundJobs)
      .finally(() => disconnectDb().finally(() => process.exit(0)));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});

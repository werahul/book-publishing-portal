// Usage: npm run seed            (upsert)
//        npm run seed -- --reset (wipe, then seed)
import { connectDb, disconnectDb } from '../config/db';
import { SEED_ADMINS, seedDatabase } from './seed';

async function main() {
  const reset = process.argv.includes('--reset');
  const authorPassword = process.env.SEED_AUTHOR_PASSWORD ?? 'Author@123';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

  await connectDb();
  const summary = await seedDatabase({ reset, authorPassword, adminPassword });

  console.log(
    `[seed] done: ${summary.authors} authors, ${summary.admins} admins, ${summary.books} books, ${summary.demoTickets} new demo tickets` +
      (summary.warnings.length ? `, ${summary.warnings.length} warning(s)` : ''),
  );
  console.log(`[seed] admin logins: ${SEED_ADMINS.map((a) => a.email).join(', ')}`);
  console.log('[seed] author logins: emails from the dataset (password from SEED_AUTHOR_PASSWORD)');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());

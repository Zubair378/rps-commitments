import 'dotenv/config';
import { buildApp } from './app.js';
import { createDatabase, migrate } from './db.js';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/dev.sqlite';
const db = createDatabase(databaseUrl);
await migrate(db);
const app = await buildApp(db, process.env.NODE_ENV === 'production');
const port = Number(process.env.PORT ?? '3000');
await app.listen({ port, host: '0.0.0.0' });
process.on('SIGTERM', async () => {
  await app.close();
  await db.destroy();
});

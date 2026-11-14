import 'dotenv/config';
import staticFiles from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { createDatabase, migrate } from './db.js';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/dev.sqlite';
const db = createDatabase(databaseUrl);
await migrate(db);
const app = await buildApp(db, process.env.NODE_ENV === 'production');
if (process.env.SERVE_WEB === '1') {
  const root = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  await app.register(staticFiles, { root, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (
      request.method === 'GET' &&
      !request.url.startsWith('/api/') &&
      !request.url.startsWith('/ws/') &&
      !request.url.includes('.')
    ) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
}
const port = Number(process.env.PORT ?? '3000');
await app.listen({ port, host: '0.0.0.0' });
process.on('SIGTERM', async () => {
  await app.close();
  await db.destroy();
});

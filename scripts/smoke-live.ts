import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argument = process.argv[2];
if (!argument) throw new Error('Usage: pnpm smoke:live https://your-app.example');
const url = new URL(argument);
if (
  (url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
) {
  throw new Error(
    'Provide an HTTPS origin without credentials or a path (HTTP localhost is allowed).',
  );
}

for (const path of ['/health', '/', '/api/params']) {
  const response = await fetch(new URL(path, url), { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  if (path === '/' && !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('The root page did not return HTML');
  }
  console.log(`${path}: HTTP ${response.status}`);
}

console.log('Creating two test accounts and playing a signed commit/reveal match...');
const script = fileURLToPath(new URL('./play-match.ts', import.meta.url));
const result = spawnSync(process.execPath, ['--import', 'tsx', script, url.origin], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Match smoke test failed');

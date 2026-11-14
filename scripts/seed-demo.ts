/** Create a fallback tournament using a demo account supplied through environment variables. */
const base = (process.env.DEMO_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const username = process.env.DEMO_USERNAME;
const password = process.env.DEMO_PASSWORD;
if (!username || !password)
  throw new Error('Set DEMO_USERNAME and DEMO_PASSWORD in the environment');
let cookie = '';
async function request(path: string, method: string, body: object) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0] ?? '';
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path}: ${String(data.error ?? response.status)}`);
  return data;
}
try {
  await request('/api/login', 'POST', { username, password });
} catch {
  await request('/api/register', 'POST', { username, password });
}
const tournament = await request('/api/tournaments', 'POST', {
  name: `Classroom demo ${new Date().toISOString().slice(0, 10)}`,
  capacity: 4,
});
console.log(`Demo tournament: ${base.replace(/\/api$/, '')}/tournaments/${String(tournament.id)}`);

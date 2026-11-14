import { timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const SAMPLES = 2_000;
const BATCH = 1_000;
const target = Buffer.from('a'.repeat(64));
const first = Buffer.from('b' + 'a'.repeat(63));
const last = Buffer.from('a'.repeat(63) + 'b');
function insecureCompare(a: Buffer, b: Buffer): boolean {
  // INSECURE-DEMO: early exit.
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const methods = { 'early-exit': insecureCompare, timingSafeEqual: timingSafeEqual };
const rows: { method: string; mismatch: string; sample: number; nanoseconds: number }[] = [];
for (const [method, compare] of Object.entries(methods)) {
  for (let i = 0; i < 1000; i++) compare(target, i % 2 ? first : last);
  for (let sample = 1; sample <= SAMPLES; sample++) {
    for (const [mismatch, candidate] of sample % 2
      ? ([
          ['first', first],
          ['last', last],
        ] as const)
      : ([
          ['last', last],
          ['first', first],
        ] as const)) {
      const begin = process.hrtime.bigint();
      for (let i = 0; i < BATCH; i++) compare(target, candidate);
      rows.push({
        method,
        mismatch,
        sample,
        nanoseconds: Number(process.hrtime.bigint() - begin) / BATCH,
      });
    }
  }
}
await mkdir('docs/results', { recursive: true });
await writeFile(
  'docs/results/timing.csv',
  [
    'method,mismatch,sample,nanoseconds',
    ...rows.map((r) => `${r.method},${r.mismatch},${r.sample},${r.nanoseconds}`),
  ].join('\n') + '\n',
);
console.log(`Recorded ${rows.length} batches of ${BATCH} comparisons in docs/results/timing.csv`);

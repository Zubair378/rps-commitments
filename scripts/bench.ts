import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Move, commitHash, commitPedersen, verifyHash, verifyPedersen } from '@rps/crypto-core';

const RUNS = 1000;
const context = { playerId: 'benchmark-player', matchId: 'benchmark-match', roundNo: 1 };
type Summary = { p50: number; p95: number; mean: number; minimum: number; maximum: number };
function summarize(values: number[]): Summary {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(values.length * 0.5)]!,
    p95: sorted[Math.floor(values.length * 0.95)]!,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    minimum: sorted[0]!,
    maximum: sorted.at(-1)!,
  };
}
function record(fn: () => void) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}
const rows: {
  environment: string;
  mode: string;
  operation: string;
  sample: number;
  milliseconds: number;
}[] = [];
const summary: Record<string, Record<string, Summary>> = {};
for (const mode of ['pedersen', 'hash'] as const) {
  const generated =
    mode === 'pedersen' ? commitPedersen(Move.Rock) : commitHash(context, Move.Rock);
  const blinding = 'blindingFactor' in generated ? generated.blindingFactor : generated.salt;
  const operations = {
    commit: () => {
      if (mode === 'pedersen') commitPedersen(Move.Rock);
      else commitHash(context, Move.Rock);
    },
    open: () => {
      JSON.stringify({ move: Move.Rock, blindingFactor: blinding });
    },
    verify: () => {
      if (mode === 'pedersen') verifyPedersen(generated.commitment, Move.Rock, blinding);
      else verifyHash(generated.commitment, context, Move.Rock, blinding);
    },
  };
  summary[mode] = {};
  for (const [operation, fn] of Object.entries(operations)) {
    for (let warm = 0; warm < 30; warm++) fn();
    const values = Array.from({ length: RUNS }, (_, sample) => {
      const milliseconds = record(fn);
      rows.push({ environment: 'Node 20', mode, operation, sample: sample + 1, milliseconds });
      return milliseconds;
    });
    summary[mode][operation] = summarize(values);
    console.log(
      `${mode} ${operation}: p50=${summary[mode][operation]!.p50.toFixed(4)}ms p95=${summary[mode][operation]!.p95.toFixed(4)}ms`,
    );
  }
}
await mkdir('docs/results', { recursive: true });
await writeFile(
  'docs/results/bench-node.json',
  JSON.stringify(
    {
      environment: `Node ${process.version}`,
      runs: RUNS,
      generatedAt: new Date().toISOString(),
      summary,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'docs/results/bench-node.csv',
  [
    'environment,mode,operation,sample,milliseconds',
    ...rows.map(
      (row) => `${row.environment},${row.mode},${row.operation},${row.sample},${row.milliseconds}`,
    ),
  ].join('\n') + '\n',
);

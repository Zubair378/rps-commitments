import { Move, commitHash, commitPedersen, verifyHash, verifyPedersen } from '@rps/crypto-core';

export type Metrics = { p50: number; p95: number; mean: number };
export type BrowserBenchmark = {
  environment: string;
  runs: number;
  generatedAt: string;
  method: string;
  summary: Record<'pedersen' | 'hash', Record<'commit' | 'open' | 'verify', Metrics>>;
  samples: {
    mode: 'pedersen' | 'hash';
    operation: 'commit' | 'open' | 'verify';
    sample: number;
    milliseconds: number;
  }[];
};
const RUNS = 1000;
function summarize(values: number[]): Metrics {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(RUNS * 0.5)]!,
    p95: sorted[Math.floor(RUNS * 0.95)]!,
    mean: values.reduce((a, b) => a + b, 0) / RUNS,
  };
}
export async function runBrowserBenchmark(
  progress: (message: string) => void,
): Promise<BrowserBenchmark> {
  const context = { playerId: 'benchmark-player', matchId: 'benchmark-match', roundNo: 1 };
  const summary = {} as BrowserBenchmark['summary'];
  const samples: BrowserBenchmark['samples'] = [];
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
    summary[mode] = {} as BrowserBenchmark['summary'][typeof mode];
    for (const [operation, fn] of Object.entries(operations) as [
      keyof typeof operations,
      () => void,
    ][]) {
      progress(`${mode} ${operation} · 0/${RUNS}`);
      for (let i = 0; i < 30; i++) fn();
      const batch = operation === 'open' ? 1000 : mode === 'hash' ? 50 : 1;
      const values: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        for (let j = 0; j < batch; j++) fn();
        const milliseconds = (performance.now() - start) / batch;
        values.push(milliseconds);
        samples.push({ mode, operation, sample: i + 1, milliseconds });
        if (i % 50 === 49) {
          progress(`${mode} ${operation} · ${i + 1}/${RUNS}`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      summary[mode][operation] = summarize(values);
    }
  }
  return {
    environment: navigator.userAgent,
    runs: RUNS,
    generatedAt: new Date().toISOString(),
    method:
      '1000 timed batches per operation; 1 Pedersen, 50 hash, or 1000 open operations per batch; results normalized per operation',
    summary,
    samples,
  };
}

import { spawn } from 'node:child_process';

const child = spawn('pnpm', ['exec', 'playwright', 'test', 'tests/e2e/benchmark.spec.ts'], {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, RUN_BENCHMARK: '1' },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

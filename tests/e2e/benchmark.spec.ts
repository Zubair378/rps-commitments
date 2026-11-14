import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.skip(!process.env.RUN_BENCHMARK, 'Run with pnpm bench:browser to record browser samples.');
test.setTimeout(180_000);

test('browser benchmark records 1,000 samples per operation and mode', async ({ page }) => {
  await page.goto('/benchmarks');
  await page.getByRole('button', { name: /Run 1,000 samples/ }).click();
  await expect(page.getByRole('heading', { name: 'Results on this device' })).toBeVisible({
    timeout: 150_000,
  });
  const result = await page.evaluate(
    () => (window as Window & { benchmarkResult?: unknown }).benchmarkResult,
  );
  expect(result).toBeTruthy();
  const data = result as {
    samples: { mode: string; operation: string; sample: number; milliseconds: number }[];
  };
  expect(data.samples).toHaveLength(6000);
  await mkdir('docs/results', { recursive: true });
  await writeFile('docs/results/bench-browser.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile(
    'docs/results/bench-browser.csv',
    [
      'environment,mode,operation,sample,milliseconds',
      ...data.samples.map(
        (row) => `Chromium,${row.mode},${row.operation},${row.sample},${row.milliseconds}`,
      ),
    ].join('\n') + '\n',
  );
  await page.screenshot({ path: 'docs/results/ui/benchmarks-desktop.png', fullPage: true });
});

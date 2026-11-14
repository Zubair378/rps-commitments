import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('two browser contexts commit, reveal, and verify a match', async ({ browser, page }) => {
  const second = await browser.newContext();
  const opponent = await second.newPage();
  const suffix = randomUUID().slice(0, 8);
  const password = `test-password-${suffix}`;
  async function register(target: typeof page, username: string) {
    await target.goto('/auth');
    await target.getByLabel('Username').fill(username);
    await target.getByLabel('Password').fill(password);
    await target.getByRole('button', { name: /Create account & key/ }).click();
    await expect(target.getByRole('heading', { name: 'Tournament lobby' })).toBeVisible();
  }
  await register(page, `alice_${suffix}`);
  await register(opponent, `bob_${suffix}`);
  await page.getByLabel('Tournament name').fill(`E2E fair match ${suffix}`);
  await page.getByLabel('Players').selectOption('2');
  await page.getByRole('button', { name: /Create tournament/ }).click();
  await expect(page.getByRole('heading', { name: `E2E fair match ${suffix}` })).toBeVisible();
  const tournamentUrl = page.url();
  await opponent.goto(tournamentUrl);
  await opponent.getByRole('button', { name: 'Join tournament' }).click();
  await expect(opponent.getByRole('link', { name: /MATCH 01/ })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: /MATCH 01/ }).click();
  const matchUrl = page.url();
  await opponent.goto(matchUrl);
  await page.getByRole('button', { name: 'Paper' }).click();
  const commitStarted = Date.now();
  const commitRequest = page.waitForRequest((request) => request.url().endsWith('/api/commit'));
  await page.getByRole('button', { name: /Commit my move/ }).click();
  const payload = JSON.parse((await commitRequest).postData() ?? '{}') as Record<string, unknown>;
  expect(payload).not.toHaveProperty('move');
  expect(payload).not.toHaveProperty('blindingFactor');
  await expect(page.getByText('Commitment locked in.')).toBeVisible();
  const commitMilliseconds = Date.now() - commitStarted;
  await opponent.getByRole('button', { name: 'Rock' }).click();
  await opponent.getByRole('button', { name: /Commit my move/ }).click();
  await expect(page.getByRole('button', { name: /Reveal and verify/ })).toBeVisible();
  await expect(opponent.getByRole('button', { name: /Reveal and verify/ })).toBeVisible();
  await page.getByRole('button', { name: /Reveal and verify/ }).click();
  const verifyStarted = Date.now();
  await expect(page.getByText('1 of 2 openings received.')).toBeVisible();
  await opponent.getByRole('button', { name: /Reveal and verify/ }).click();
  await expect(page.getByText('verified', { exact: true })).toHaveCount(2);
  const verifyMilliseconds = Date.now() - verifyStarted;
  await expect(page.getByText(`${`alice_${suffix}`} wins the match`)).toBeVisible();
  await page.screenshot({ path: 'docs/results/ui/match-desktop.png', fullPage: true });
  await writeFile(
    'docs/results/ux-local.json',
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        environment: 'local Chromium to local Vite/Fastify/SQLite',
        commitMilliseconds,
        secondRevealToVerifiedMilliseconds: verifyMilliseconds,
      },
      null,
      2,
    ) + '\n',
  );
  await second.close();
});

test('landing page fits a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Play fair/ })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'docs/results/ui/home-mobile.png', fullPage: true });
});

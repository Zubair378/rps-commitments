import { expect, test } from '@playwright/test';

test('attack lab runs a vulnerable and protected example', async ({ page }) => {
  await page.goto('/attack-lab');
  await expect(page.getByRole('heading', { name: 'Attack lab' })).toBeVisible();
  await page.getByRole('button', { name: 'Run experiment' }).first().click();
  await expect(page.getByText('Vulnerable: attack succeeded')).toBeVisible();
  await expect(page.getByText('Protected: attack blocked')).toBeVisible();
  await page.screenshot({ path: 'docs/results/ui/attack-lab.png', fullPage: true });
  await page.getByRole('link', { name: /homomorphic lab/ }).click();
  await page.getByRole('button', { name: /Generate example/ }).click();
  await expect(page.getByText('points match')).toBeVisible();
});

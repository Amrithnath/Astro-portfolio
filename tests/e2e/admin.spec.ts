import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('CMS editor boots under its production CSP and offers GitHub sign-in only', async ({ page }) => {
  const headers = await readFile('public/_headers', 'utf8');
  const csp = headers
    .split('/admin/*\n')[1]
    .match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1]
    .replace(/;\s*upgrade-insecure-requests/, '');
  expect(csp).toBeTruthy();

  const errors: string[] = [];
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/admin/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp! } });
  });

  await page.goto('/admin/');
  await expect(page.getByRole('button', { name: /Sign In with \W*GitHub/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /token/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

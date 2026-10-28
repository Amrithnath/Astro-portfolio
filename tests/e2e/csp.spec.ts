import { expect } from '@playwright/test';
import { test } from './csp-fixture';

test('CSP allows deferred terminal, theme changes and page navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-terminal-fragment]')).toBeAttached();
  await page.getByRole('button', { name: 'light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => { (window as unknown as { __cspDocument: boolean }).__cspDocument = true; });
  await page.locator('.terminal-tabs a[href="/resume"]').click();
  await expect(page.locator('#terminal-input')).toBeVisible();
  // Tabs are full document loads (no ClientRouter), so the marker must be gone.
  expect(await page.evaluate(() => (window as unknown as { __cspDocument?: boolean }).__cspDocument)).toBeUndefined();
  await page.goto('/blog/bluetooth-dystopia/');
  await expect(page.locator('article')).toBeVisible();
  await page.waitForLoadState('networkidle');
});

test('resume print popup inherits a policy that permits its generated styles', async ({ page, context }) => {
  await context.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printed = 'true'; };
    window.close = () => {};
  });
  await page.goto('/resume/');
  await page.locator('#toggle-visual-generator').click();
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#export-pdf').click();
  const popup = await popupPromise;
  await expect(popup.locator('html')).toHaveAttribute('data-printed', 'true');
  await expect(popup.locator('.resume-header')).toBeVisible();
  await popup.close();
});

for (const route of ['/offline/', '/terminal-full/', '/blog/', '/blogs/']) {
  test(`${route} fallback/fragment/redirect remains CSP-compatible`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
}

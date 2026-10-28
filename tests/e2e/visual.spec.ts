import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const routes = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about/' },
  { name: 'resume', path: '/resume/' },
  { name: 'project', path: '/project/webDev/weather-app/' },
  { name: 'projects', path: '/projects/' },
  { name: '404', path: '/does-not-exist/' },
];

for (const theme of ['terminal', 'light'] as const) {
  for (const route of routes) {
    test(`${route.name} ${theme} @visual`, async ({ page }, testInfo) => {
      const snapshot = `${route.name}-${theme}.png`;
      if (
        process.env.CI && process.platform === 'linux' &&
        testInfo.config.updateSnapshots === 'none' && !existsSync(testInfo.snapshotPath(snapshot))
      ) {
        console.log(
          `::notice::Missing Linux visual baseline: ${snapshot} (${testInfo.project.name}). ` +
          'Run the "Update visual baselines" workflow on this branch.'
        );
        test.skip(true, 'Generate Linux snapshots with the Update visual baselines workflow.');
      }

      await page.addInitScript(id => localStorage.setItem('portfolio-theme', id), theme);
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(route.name === '404' ? 404 : 200);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.terminal')).toBeVisible();
      if (route.name === 'home') {
        await expect(page.locator('#main-content [data-terminal-fragment]')).toHaveCount(1);
        await expect(page.getByRole('region', { name: 'About JSON', exact: true })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.locator('img').evaluateAll(images =>
        // Offscreen lazy images never load, so decode() would hang; only wait for eager/loaded ones.
        Promise.all(images
          .map(image => image as HTMLImageElement)
          .filter(image => image.complete || image.loading !== 'lazy')
          .map(image => image.decode().catch(() => undefined)))
      );

      await page.locator('.command-output').filter({ hasText: /^up \d/ }).evaluateAll(elements => {
        elements.forEach(element => element.setAttribute('data-visual-dynamic', ''));
      });

      // Viewport captures cover the shell and page entry. Homepage copy/uptime and ASCII glyphs
      // are generated randomly per build; reserve stable space as masking alone cannot fix reflow.
      await page.addStyleTag({
        content: `
          .nf-row:has(.nf-value.v-fg) { height: 4.5em !important; overflow: hidden !important; }
          [data-visual-dynamic] { height: 3em !important; overflow: hidden !important; }
        `,
      });
      await expect(page).toHaveScreenshot(snapshot, {
        mask: [
          page.locator('.nf-grid, .nf-row:has(.nf-value.v-fg)'),
          page.locator('.command-output').filter({
            hasText: /^(up \d|\d\d:\d\d\s+up|Last login:|Astro\/Terminal v)/,
          }),
          page.locator(
            'time, [data-build-version], [data-build-commit], [data-timestamp], ' +
            '[data-view-count], [data-clock], [data-carbon-badge]'
          ),
          page.locator('[aria-label="About JSON"] .json-string').nth(2),
          page.locator('[aria-label="About JSON"] .json-string').nth(3),
          page.locator('[aria-label="About JSON"] .json-string').nth(4),
        ],
      });
    });
  }
}

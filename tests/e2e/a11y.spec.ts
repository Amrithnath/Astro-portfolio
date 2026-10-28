import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/about/', '/projects/', '/project/webDev/amrithnath-dev/', '/contact/', '/resume/', '/blog/', '/photography/', '/photography/tags/landscape/', '/photography/albums/landscapes/', '/photography/pine-ridge/', '/photography/places/', '/photography/map/', '/photography/prints/', '/now/', '/uses/', '/search/', '/search/?q=Bluetooth', '/privacy-check/', '/work-in-progress/', '/does-not-exist/'];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const route of routes) {
    test(`${route} (${colorScheme}) has no serious or critical axe violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = violations
        .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
        .map(violation => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s) — ${violation.help}`);
      expect(blocking, 'Serious/critical accessibility violations').toEqual([]);
    });
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`wide-screen side panes (${colorScheme}) have no serious or critical axe violations`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/about/');
    await expect(page.locator('.side-pane').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .include('.side-pane')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = violations
      .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
      .map(violation => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s) — ${violation.help}`);
    expect(blocking, 'Serious/critical accessibility violations').toEqual([]);
  });
}

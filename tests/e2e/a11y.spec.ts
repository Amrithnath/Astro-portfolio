import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/about/', '/projects/', '/contact/', '/resume/', '/work-in-progress/', '/does-not-exist/'];

for (const route of routes) {
  test(`${route} has no serious or critical axe violations`, async ({ page }) => {
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

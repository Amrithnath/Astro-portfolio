import { readFile } from 'node:fs/promises';
import { expect, test as base } from '@playwright/test';

// Keep the guard active through deferred loading, interactions, and fixture teardown.
const test = base.extend<{ browserErrors: void }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', message => {
      if (message.type() !== 'error') return;
      // Chromium reports the intentional missing-route response as a console error.
      if (message.text().includes('Failed to load resource:') &&
          message.text().includes('404') &&
          new URL(message.location().url).pathname === '/does-not-exist/') return;
      errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors, 'Unexpected browser console/page errors').toEqual([]);
  }, { auto: true }],
});

for (const route of ['/', '/about/', '/projects/', '/contact/', '/resume/', '/blogs/', '/photography/', '/does-not-exist/']) {
  test(`${route} loads with the expected terminal cursor`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(route === '/does-not-exist/' ? 404 : 200);
    if (route === '/blogs/') await expect(page).toHaveURL(/\/work-in-progress\/?$/);
    await expect(page.locator('.terminal')).toBeVisible();
    // Wait for deferred content and production service-worker registration as well.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.cursor:visible')).toHaveCount(route === '/resume/' ? 0 : 1);
    if (route === '/does-not-exist/') {
      await expect(page.getByText("ls: cannot access '/requested/path': No such file or directory")).toBeVisible();
    }
  });
}

test('resume starts in CLI mode and exports current experience as Markdown', async ({ page }) => {
  await page.goto('/resume/');
  await expect(page.locator('#terminal-input')).toBeVisible();
  await expect(page.locator('#resume-tools')).toBeHidden();
  const toggle = page.locator('#toggle-visual-generator');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#resume-tools')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-md').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  expect(await readFile((await download.path())!, 'utf8')).toContain('Oct 2025 – Present');
});

test('resume CLI renders markup as text, never an image or dialog', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto('/resume/');
  const payload = '<img src=x onerror=alert(1)>';
  await page.locator('#terminal-input').fill(payload);
  await page.locator('#terminal-input').press('Enter');
  await expect(page.locator('#terminal-output .command').last()).toHaveText(payload);
  await expect(page.locator('#terminal-output img')).toHaveCount(0);
  await expect(page.locator('#terminal-input')).toHaveValue('');
  await page.waitForLoadState('networkidle');
  expect(dialogs).toEqual([]);
});

test('about exposes the skills tree and a hidden crawler-readable profile', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByText('primary-language/', { exact: true })).toBeVisible();
  await expect(page.getByText('go.go', { exact: true })).toBeVisible();
  const profile = page.locator('.profile-summary');
  await expect(profile).toHaveCount(1);
  await expect(profile).toHaveAttribute('hidden', '');
  await expect(profile).not.toBeVisible();
});

for (const resource of ['robots.txt', 'llms.txt', 'sitemap-index.xml', 'rss.xml']) {
  test(`${resource} is discoverable`, async ({ request }) => {
    const response = await request.get(`/${resource}`);
    expect(response.status()).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(0);
  });
}

for (const route of ['/', '/resume/']) {
  test(`${route} terminal output is keyboard-scrollable on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const output = route === '/'
      ? page.getByRole('region', { name: 'About JSON', exact: true })
      : page.getByRole('region', { name: 'Resume terminal output', exact: true });
    await expect(output).toBeVisible();
    await output.focus();
    await expect(output).toBeFocused();
    await output.press(route === '/' ? 'ArrowRight' : 'ArrowDown');
    await expect.poll(() => output.evaluate(element =>
      location.pathname === '/' ? element.scrollLeft : element.scrollTop
    )).toBeGreaterThan(0);
  });
}

test('photography is unlisted and its lightbox opens, cycles and restores focus', async ({ page, request }) => {
  await page.goto('/photography/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('a[href^="/photography"]')).toHaveCount(0);
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/photography');

  const links = page.locator('.gallery-link');
  expect(await links.count()).toBeGreaterThan(1);
  const dialog = page.locator('dialog.lightbox');
  const image = dialog.locator('.lightbox-image');
  await links.first().click();
  await expect(dialog).toBeVisible();
  await expect(image).toHaveAttribute('alt', (await links.first().getAttribute('data-alt'))!);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowRight');
  await expect(image).toHaveAttribute('src', (await links.nth(1).getAttribute('data-full'))!);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(links.first()).toBeFocused();
});


test('projects can be filtered by technology and announce the result count', async ({ page }) => {
  await page.goto('/projects/');
  const card = page.locator('.project-card');
  await expect(card).toHaveCount(1);
  const filter = page.getByRole('button', { name: /--tech dev/ });
  await expect(filter).toBeVisible();
  await expect(filter).toHaveAttribute('aria-pressed', 'false');
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#project-filter-command')).toHaveText('$ ls projects --tech dev');
  await expect(page.locator('#project-count')).toHaveText('Showing 1 of 1 projects');
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#project-filter-command')).toHaveText('$ ls projects');
});

test('projects render an empty write-up state when no article is linked', async ({ page }) => {
  await page.goto('/project/webDev/weather-app/');
  await expect(page.getByRole('heading', { name: 'Write-ups' })).toBeVisible();
  await expect(page.getByText('No write-ups are linked to this project yet.')).toBeVisible();
});

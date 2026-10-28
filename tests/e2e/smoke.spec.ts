import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test as base } from './csp-fixture';

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

for (const route of ['/', '/about/', '/projects/', '/contact/', '/resume/', '/blog/', '/photography/', '/does-not-exist/']) {
  test(`${route} loads with the expected terminal cursor`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(route === '/does-not-exist/' ? 404 : 200);
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

test('resume CLI echoes typed commands with syntax-highlighted tokens', async ({ page }) => {
  await page.goto('/resume/');
  await page.locator('#terminal-input').fill('generate pdf --force');
  await page.locator('#terminal-input').press('Enter');
  const echoed = page.locator('#terminal-output .command').last();
  await expect(echoed.locator('.sh-cmd')).toHaveText('generate');
  await expect(echoed.locator('.sh-flag')).toHaveText('--force');
});

test('prompt commands render zsh-style highlighted tokens', async ({ page }) => {
  await page.goto('/about/');
  const command = page.locator('#main-content .command', { hasText: 'ls -la' }).first();
  await expect(command.locator('.sh-cmd')).toHaveText('ls');
  await expect(command.locator('.sh-flag')).toHaveText('-la');
});

test('wide screens fill the gutters with tmux-style panes; narrower screens hide them', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/about/');
  const left = page.getByRole('complementary', { name: 'Page manual and career' });
  const right = page.getByRole('complementary', { name: 'Profile and skills' });
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await expect(left.locator('.man-page')).toContainText('NAME');
  await expect(left.locator('.career-graph li').first()).toContainText('HEAD -> main');
  await expect(right.locator('.pane-fetch')).toContainText('hello@amrithnath.dev');
  await expect(right.locator('.htop-group')).toHaveText(['Top skills']);
  // /now is placeholder text, so its section stays hidden.
  await expect(right.locator('.now-log')).toHaveCount(0);
  const chrome = await page.locator('.window-chrome').boundingBox();
  const pane = await left.boundingBox();
  const main = await page.locator('.terminal').boundingBox();
  expect(Math.abs(pane!.y - chrome!.height)).toBeLessThan(2);
  expect(pane!.x + pane!.width).toBeLessThanOrEqual(main!.x + 1);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
});

test('side panes vary with page content', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/resume/');
  const right = page.getByRole('complementary', { name: 'Profile and skills' });
  expect(await right.locator('.htop-group').count()).toBeGreaterThan(3);
  await expect(page.locator('.commit-tech').first()).toBeVisible();

  await page.goto('/project/webDev/weather-app/');
  const left = page.getByRole('complementary', { name: 'Page manual and career' });
  await expect(left.locator('.man-page')).toContainText('weather-app - Weather app');
  await expect(left.locator('.career-graph li.focused')).toHaveCount(1);
  await expect(left.getByRole('link', { name: 'projects(1)' })).toHaveAttribute('href', '/projects');

  await page.goto('/photography/');
  await expect(left.locator('.career-graph')).toHaveCount(0);
  await expect(left.getByRole('link', { name: 'places/' })).toBeVisible();
  await expect(right.locator('.pane-fetch')).toHaveCount(0);
});

test('perf monitor and carbon badge measure locally without contacting Website Carbon off production', async ({ page }) => {
  const carbonRequests: string[] = [];
  page.on('request', request => {
    const { hostname } = new URL(request.url());
    if (hostname === 'websitecarbon.com' || hostname.endsWith('.websitecarbon.com')) carbonRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/about/', { waitUntil: 'load' });
  const monitor = page.locator('[data-perf-mon]');
  await expect(monitor).toBeVisible();
  await expect(monitor.locator('[data-metric="ttfb"]')).toHaveText(/\d+(\.\d+)? m?s/);
  await expect(monitor.locator('[data-metric="requests"]')).toHaveText(/^[1-9]\d*$/);
  await expect(monitor.locator('[data-rating="ttfb"]')).toHaveText(/^· (fast|okay|slow)$/);
  await expect(monitor.locator('[data-metric-label="ttfb"]')).toHaveText('server reply');
  await monitor.getByText('what do these mean?').click();
  await expect(monitor.locator('.pane-help')).toContainText('Largest Contentful Paint');
  await expect(monitor.locator('[data-metric="co2-cold"]')).toHaveText(/^\d+\.\d+ g \((A\+|[A-F])\)$/);
  const badge = page.locator('[data-carbon-badge]');
  await expect(badge).toBeVisible();
  await expect(badge.locator('[data-carbon-value]')).toHaveText(/^\d+\.\d+ g\/view$/);
  await expect(badge.locator('[data-carbon-detail]')).toContainText('estimated locally');
  const status = page.getByRole('contentinfo').locator('.site-status');
  await expect(status.locator('[data-build-version]')).toHaveText(/^\d+\.\d+\.\d+$/);
  await expect(status.getByRole('navigation', { name: 'Site links' }).getByRole('link')).toHaveText(['privacy', 'scan', 'rss', 'source']);
  expect(carbonRequests).toEqual([]);
});

test('privacy check runs locally when typed and explains itself', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => {
    if (!['localhost', '127.0.0.1'].includes(new URL(request.url()).hostname)) external.push(request.url());
  });
  await page.route('https://endoflife.date/**', route =>
    route.fulfill({
      json: { result: { releases: [{ name: '999', isMaintained: true, latest: { name: '999.0.1' } }, { name: '998', isMaintained: false }] } },
      headers: { 'access-control-allow-origin': '*' },
    })
  );
  await page.goto('/privacy-check/');
  await expect(page.locator('script[src*="beacon"]')).toHaveCount(0);
  await expect(page.getByRole('note')).toContainText('fingerprints your browser locally');
  const input = page.getByRole('textbox', { name: 'Privacy check command' });
  const log = page.getByRole('log');

  await input.fill('run check --help');
  await input.press('Enter');
  await expect(log).toContainText('usage: run check [--offline] [--stun]');
  await expect(log.locator('.privacy-heading')).toHaveCount(7);
  await expect(log.locator('.privacy-echo .sh-flag')).toHaveText('--help');

  await input.fill('run check --offline');
  await input.press('Enter');
  await expect(log.locator('.privacy-summary')).toContainText('done:');
  await expect(log.locator('.privacy-result')).toHaveCount(7);
  await expect(log).toContainText('support not checked offline');
  expect(external.filter(url => url.includes('endoflife.date'))).toEqual([]);

  await input.fill('clear');
  await input.press('Enter');
  await input.fill('run check');
  await input.press('Enter');
  await expect(log.locator('.privacy-summary')).toContainText('done:');
  await expect(log.locator('.privacy-result', { has: page.locator('.privacy-id', { hasText: /^browser\s*$/ }) })).toContainText(
    'no longer receives security fixes'
  );
  await input.fill('explain browser');
  await input.press('Enter');
  await expect(log).toContainText('your result:');
  await input.fill('sudo rm -rf /');
  await input.press('Enter');
  await expect(log.locator('.privacy-error')).toContainText('command not found');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('sudo rm -rf /');
  expect(external.filter(url => new URL(url).hostname !== 'endoflife.date')).toEqual([]);
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
  await expect(page.getByRole('navigation', { name: 'Photography', exact: true })).toBeVisible();
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

test('photography flag filters update the prompt and lightbox sees only visible photos', async ({ page }) => {
  await page.goto('/photography/');
  const sunset = page.getByRole('button', { name: '--tag sunset (1)', exact: true });
  await sunset.click();
  await expect(sunset).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-filter-prompt]')).toHaveText('$ ls ~/photography --tag sunset');
  await expect(page.locator('.gallery-item:visible')).toHaveCount(1);
  const visible = page.locator('.gallery-item:visible .gallery-link');
  const source = await visible.getAttribute('data-full');
  await visible.click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lightbox-image')).toHaveAttribute('src', source!);
  await page.keyboard.press('Escape');
  await sunset.click();
  await expect(page.locator('.gallery-item:visible')).toHaveCount(2);
  await expect(page.locator('[data-filter-prompt]')).toHaveText('$ ls ~/photography');
  await page.getByRole('button', { name: '--album Landscapes (2)', exact: true }).click();
  await expect(page.locator('[data-filter-prompt]')).toContainText('--album landscapes');
});

for (const route of ['tags/', 'tags/landscape/', 'places/', 'map/', 'prints/', 'albums/', 'albums/landscapes/', 'pine-ridge/']) {
  test('photography/' + route + ' stays unlisted and renders connected pages', async ({ page }) => {
    await page.goto('/photography/' + route);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: 'All photos', exact: true })).toHaveAttribute('href', '/photography/');
    if (route === 'tags/landscape/' || route === 'albums/landscapes/') {
      await expect(page.locator('.gallery-item')).toHaveCount(2);
      await expect(page.locator('a.gallery-title').first()).toHaveAttribute('href', '/photography/pine-ridge/');
    }
    if (route === 'pine-ridge/') {
      await expect(page.getByRole('link', { name: '#landscape', exact: true })).toHaveAttribute('href', '/photography/tags/landscape/');
      await expect(page.getByRole('link', { name: 'Landscapes', exact: true })).toHaveAttribute('href', '/photography/albums/landscapes/');
      await expect(page.getByRole('navigation', { name: 'Adjacent photos' })).toContainText('Golden hour');
    }
    if (route === 'places/') {
      await expect(page.getByText('No places added yet.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'View the places map' })).toHaveAttribute('href', '/photography/map/');
    }
    if (route === 'pine-ridge/') {
      await expect(page.getByRole('region', { name: 'Photo information' })).toHaveCount(0);
    }
    if (route === 'map/') {
      await expect(page.getByText('No places with coordinates added yet.')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Photography places' })).toBeVisible();
    }
    if (route === 'prints/') {
      await expect(page.getByText('PLACEHOLDER — details have not been set by the photographer.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'hello@amrithnath.dev' })).toHaveAttribute('href', 'mailto:hello@amrithnath.dev');
      await expect(page.getByText(/All photographs ©/)).toContainText('All rights reserved unless explicitly stated otherwise.');
    }
  });
}

test('photography remains browsable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + '/photography/');
    await expect(page.locator('.gallery-item')).toHaveCount(2);
    await expect(page.locator('[data-photo-filters]')).toBeHidden();
    await page.getByRole('link', { name: '#sunset', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('sunset');
    await expect(page.locator('.gallery-item')).toHaveCount(1);
  } finally { await context.close(); }
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

for (const choice of ['dark', 'light'] as const) {
  test(`${choice} selection persists through reload and navigation`, async ({ page }) => {
    await page.goto('/');
    const switcher = page.getByRole('group', { name: 'Color theme', exact: true });
    await expect(switcher).toHaveCount(1);
    await switcher.getByRole('button', { name: choice, exact: true }).click();
    const id = choice === 'dark' ? 'terminal' : 'light';
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBe(id);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(switcher.getByRole('button', { name: choice, exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await page.locator('.terminal-tabs a[href="/about"]').click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(switcher).toHaveCount(1);
    await expect(switcher.getByRole('button', { name: choice, exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await switcher.getByRole('button', { name: choice === 'dark' ? 'light' : 'dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', choice === 'dark' ? 'light' : 'terminal');
  });
}

test('light theme never flashes the default theme during home to about navigation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('portfolio-theme', 'light');
    // Record the theme at first paint and at every later change on each document.
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    requestAnimationFrame(() => seen.push('paint:' + document.documentElement.dataset.theme));
    new MutationObserver(() => seen.push(document.documentElement.dataset.theme ?? ''))
      .observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.terminal-tabs a[href="/about"]').click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen))
    .toEqual(['light', 'paint:light']);
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
});

test('auto follows live system changes and the switcher is keyboard-accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const switcher = page.getByRole('group', { name: 'Color theme', exact: true });
  const auto = switcher.getByRole('button', { name: 'auto', exact: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const dark = switcher.getByRole('button', { name: 'dark', exact: true });
  await dark.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await auto.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBeNull();
  const bounds = await switcher.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.locator('.terminal-tabs a[href="/about"]').click();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await page.reload();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
});

test('theme choices synchronize across tabs, including reset to auto', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('/about/');
  const switcher = page.getByRole('group', { name: 'Color theme', exact: true });
  await switcher.getByRole('button', { name: 'dark', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await expect(other.getByRole('button', { name: 'dark', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await other.getByRole('button', { name: 'auto', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(switcher.getByRole('button', { name: 'auto', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await other.close();
});

test('without JavaScript the switcher is hidden and terminal remains the default', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
  await expect(page.locator('[data-theme-switcher]')).toBeHidden();
  await context.close();
});

test('now page is unlisted and flags its placeholder content', async ({ page, request }) => {
  await page.goto('/now/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("What I'm doing now");
  await expect(page.getByRole('note')).toContainText('placeholder');
  await expect(page.getByRole('heading', { name: 'Photography', level: 2 })).toBeVisible();
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/now');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /now');
});

test('uses page is unlisted and flags its placeholder content', async ({ page, request }) => {
  await page.goto('/uses/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What I use');
  await expect(page.getByRole('note')).toContainText('placeholder');
  await expect(page.getByRole('heading', { name: 'Photography gear', level: 2 })).toBeVisible();
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/uses');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /uses');
});

test('photo RSS is linked only inside photography and includes usable image media', async ({ page, request }) => {
  await page.goto('/photography/');
  await expect(page.getByRole('link', { name: 'Photo RSS feed' })).toHaveAttribute('href', '/photography/rss.xml');
  const response = await request.get('/photography/rss.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');
  const xml = await response.text();
  const feed = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    return {
      errors: document.querySelectorAll('parsererror').length,
      items: [...document.querySelectorAll('item')].map((item) => ({
        title: item.querySelector('title')?.textContent,
        description: item.querySelector('description')?.textContent,
        link: item.querySelector('link')?.textContent,
        image: item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0]?.getAttribute('url'),
      })),
    };
  }, xml);
  expect(feed.errors).toBe(0);
  expect(feed.items).toHaveLength(2);
  for (const item of feed.items) {
    expect(item.title).toBeTruthy();
    expect(item.description).toBeTruthy();
    expect(item.link).toMatch(/^https:\/\/amrithnath\.dev\/photography\/[\w-]+\/$/);
    const imagePath = new URL(item.image!).pathname;
    expect(imagePath).toMatch(/\.webp$/);
    expect((await request.get(imagePath)).status()).toBe(200);
  }
  for (const resource of ['/robots.txt', '/llms.txt', '/sitemap-0.xml']) {
    expect(await (await request.get(resource)).text()).not.toContain('/photography/rss.xml');
  }
  await page.goto('/');
  await expect(page.locator('a[href^="/photography"], link[href*="/photography"]')).toHaveCount(0);
});

test('places map is self-contained and available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const external: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
    });
    await page.goto(baseURL + '/photography/places/');
    await page.getByRole('link', { name: 'View the places map' }).click();
    await expect(page.locator('svg .land')).toHaveAttribute('d', /^M/);
    await expect(page.getByText('No places with coordinates added yet.')).toBeVisible();
    await expect(page.locator('svg image, svg script, svg use, iframe')).toHaveCount(0);
    expect(external).toEqual([]);
  } finally { await context.close(); }
});

test('article view counter only runs when PUBLIC_VIEWS_URL was set at build time', async ({ page }) => {
  const viewRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/views') viewRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.route(/\/views(\?|$)/, route => route.fulfill({
    json: { path: '/project/webDev/weather-app/', count: 1234 },
    headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await page.goto('/project/webDev/weather-app/');
  await page.waitForLoadState('networkidle');
  const counter = page.locator('[data-view-count]');
  if (!(await counter.count())) {
    // CI default: no VIEWS_URL variable, so no markup and no network calls.
    expect(viewRequests).toEqual([]);
    return;
  }
  // Off the production hostname the counter only reads, never increments.
  await expect(counter).toHaveText('views: 1,234');
  expect(viewRequests).toHaveLength(1);
  expect(viewRequests[0]).toMatch(/^GET .*\/views\?path=%2Fproject%2FwebDev%2Fweather-app%2F$/);
});

test('blog tab opens the blog index directly and /blogs/ falls back to it', async ({ page }) => {
  await page.goto('/about/');
  await page.locator('.terminal-tabs a[href="/blog/"]').click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
  await expect(page.locator('.terminal-tabs a[href="/blog/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('status')).toContainText('no posts are published yet');
  await expect(page.getByRole('link', { name: 'Subscribe via RSS' })).toHaveAttribute('href', '/rss.xml');
  await page.goto('/blogs/');
  await expect(page).toHaveURL(/\/blog\/$/);
});

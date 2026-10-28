import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test } from './csp-fixture';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`search finds an article under its production CSP (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    // The CSP fixture applies the production response policy on top of the built meta policy.
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.goto('/search/?q=weather');
    await expect(page.getByRole('searchbox', { name: 'Search this site' })).toHaveValue('weather');
    await expect(page.getByRole('status')).toContainText(/\d+ results? for/);
    await expect(page.getByRole('link', { name: 'Weather app' }))
      .toHaveAttribute('href', '/project/webDev/weather-app/');
    await expect(page.locator('[data-search-results] a[href^="/photography/"]')).toHaveCount(0);
    await expect(page.locator('[data-search-results] a[href^="/now/"]')).toHaveCount(0);
    expect(failures).toEqual([]);

    const query = page.getByRole('searchbox', { name: 'Search this site' });
    await query.fill('zzzznonexistentquery');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('No results for “zzzznonexistentquery”.');
    await expect(page.locator('[data-search-results] li')).toHaveCount(0);
    await expect(page).toHaveURL(/q=zzzznonexistentquery/);
    await query.fill('');
    await expect(page.getByRole('status')).toHaveText('Enter a query to search.');
    await expect(page).not.toHaveURL(/\?q=/);
  });
}

test('index contains public pages, never unlisted or nonindexable documents', async ({ page }) => {
  await page.goto('/search/');
  const urls = await page.evaluate(async () => {
    const path = '/pagefind/pagefind.js';
    const pagefind = await import(/* @vite-ignore */ path);
    const { results } = await pagefind.search(null);
    return Promise.all(results.map(async (result: { data: () => Promise<{ url: string }> }) => (await result.data()).url));
  });
  expect(urls).toEqual(expect.arrayContaining(['/', '/about/', '/projects/', '/resume/', '/project/webDev/weather-app/']));
  expect(urls).not.toContain('/blog/bluetooth-dystopia/');
  expect(urls.some(url => /^\/(?:photography|now|search|admin|terminal-full|offline|404|work-in-progress)(?:\/|$)/.test(url) || url === '/blogs/')).toBe(false);
});

test('search lazily loads its index and handles unavailable assets', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/pagefind/')) requests.push(request.url());
  });
  await page.goto('/search/');
  await expect(page.getByRole('status')).toHaveText('Enter a query to search.');
  expect(requests).toEqual([]);
  await page.route('**/pagefind/**', route => route.abort());
  await page.getByRole('searchbox').fill('weather');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Search is unavailable.');
});

test('only the search page CSP allows WebAssembly', () => {
  const { headers: rules } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  for (const path of ['/about/', '/search/', '/admin/']) {
    const policies = rules.filter(rule => new RegExp('^' + rule.source + '$').test(path))
      .flatMap(rule => rule.headers.filter(header => header.key === 'Content-Security-Policy'));
    expect(policies).toHaveLength(1);
    expect(policies[0].value).not.toContain("'wasm-unsafe-eval'");
    const scriptSources = policies[0].value.split(';').map(d => d.trim().split(/\s+/)).find(([name]) => name === 'script-src')?.slice(1) ?? [];
    if (path === '/admin/') expect(scriptSources).toContain('https://unpkg.com');
    else expect(scriptSources).not.toContain('https://unpkg.com');
  }
  for (const file of ['about/index.html', 'search/index.html']) {
    const meta = readFileSync('dist/' + file, 'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    expect(meta).toBeTruthy();
    expect(meta!.includes("'wasm-unsafe-eval'")).toBe(file.startsWith('search/'));
  }
});

import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test } from './csp-fixture';

for (const theme of ['terminal', 'light']) {
  test(`photo viewer keyboard, focus and accessibility (${theme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(theme => localStorage.setItem('portfolio-theme', theme), theme);
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/photography/pine-ridge/');
    expect(requests.some(url => /photo-viewer.*\.js/.test(url))).toBe(false);
    expect(await page.locator('dialog').isVisible()).toBe(false);
    const opener = page.getByRole('button', { name: 'Open full-screen photo' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Pine ridge' });
    await expect(dialog).toBeVisible();
    const stage = dialog.locator('[data-stage]');
    await expect(stage).toHaveAttribute('data-scale', '1.000');
    await expect(dialog.locator('[data-preview]')).toBeVisible();
    await page.keyboard.press('+');
    await expect(stage).toHaveAttribute('data-scale', '1.250');
    await page.keyboard.press('ArrowRight');
    await expect(stage).not.toHaveAttribute('data-pan', '0.0,0.0');
    await page.keyboard.press('0');
    await expect(stage).toHaveAttribute('data-scale', '1.000');
    await expect(stage).toHaveAttribute('data-pan', '0.0,0.0');
    await dialog.getByRole('button', { name: 'Fit (0)' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close photo viewer' })).toBeFocused();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await opener.click();
    // The stage retains its previous scale while the lazy viewer initializes again.
    await expect(dialog.locator('[data-preview]')).toHaveAttribute('style', /scale\(1\)/);
    await expect(stage).toHaveAttribute('data-scale', '1.000');
    await page.keyboard.press('+');
    await expect(stage).toHaveAttribute('data-scale', '1.250');
    await page.keyboard.press('Escape');
    expect(requests.some(url => /photo-viewer.*\.js/.test(url))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('CSS fallback keeps wheel zoom, drag, double-click and zoom bounds', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/photography/pine-ridge/');
  await page.getByRole('button', { name: 'Open full-screen photo' }).click();
  const stage = page.locator('[data-stage]');
  await expect(page.locator('[data-photo-viewer]')).toHaveAttribute('data-renderer', 'css');
  await expect(stage).toHaveAttribute('data-scale', '1.000');
  const box = (await stage.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx + 100, cy);
  await page.mouse.wheel(0, -180);
  await expect.poll(() => stage.getAttribute('data-scale')).not.toBe('1.000');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 100, cy, { steps: 4 });
  await page.mouse.up();
  await expect(stage).not.toHaveAttribute('data-pan', '0.0,0.0');
  await page.keyboard.press('0');
  await page.mouse.dblclick(cx, cy);
  await expect(stage).toHaveAttribute('data-scale', '2.500');
  for (let i = 0; i < 12; i++) await page.keyboard.press('+');
  await expect(stage).toHaveAttribute('data-scale', '8.000');
  for (let i = 0; i < 25; i++) await page.keyboard.press('-');
  await expect(stage).toHaveAttribute('data-scale', '1.000');
});

test('WebGL texture and context loss preserve the image fallback', async ({ page }) => {
  await page.goto('/photography/pine-ridge/');
  await page.getByRole('button', { name: 'Open full-screen photo' }).click();
  const canvas = page.locator('dialog canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(node => {
    const gl = (node as HTMLCanvasElement).getContext('webgl')!;
    return gl.getError();
  })).toBe(0);
  await canvas.evaluate(node => {
    (node as HTMLCanvasElement).getContext('webgl')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('[data-photo-viewer]')).toHaveAttribute('data-renderer', 'css');
  await page.keyboard.press('+');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-scale', '1.250');
});

test('photo remains readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL + '/photography/pine-ridge/');
  const photo = page.locator('[data-photo-viewer] picture img');
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Open full-screen photo' })).toHaveCount(0);
  await context.close();
});

test('touch pinch, pan and double-tap work with pointer capture', async ({ page, context }) => {
  await page.goto('/photography/pine-ridge/');
  await page.getByRole('button', { name: 'Open full-screen photo' }).click();
  const stage = page.locator('[data-stage]');
  await expect(stage).toHaveAttribute('data-scale', '1.000');
  const box = (await stage.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x: x - 40, y, id: 1 }, { x: x + 40, y, id: 2 }]);
  await touch('touchMove', [{ x: x - 120, y, id: 1 }, { x: x + 120, y, id: 2 }]);
  await touch('touchEnd', []);
  await expect.poll(async () => Number(await stage.getAttribute('data-scale'))).toBeGreaterThan(2);
  await touch('touchStart', [{ x, y, id: 1 }]);
  await touch('touchMove', [{ x: x + 80, y: y + 20, id: 1 }]);
  await touch('touchEnd', []);
  await expect(stage).not.toHaveAttribute('data-pan', '0.0,0.0');
  await page.keyboard.press('0');
  for (let i = 0; i < 2; i++) {
    await touch('touchStart', [{ x, y, id: 1 }]);
    await touch('touchEnd', []);
  }
  await expect(stage).toHaveAttribute('data-scale', '2.500');
});

for (const cors of [true, false]) {
  test(`remote detail uses ${cors ? 'anonymous WebGL textures' : 'CSS fallback without CORS'}`, async ({ page, context }) => {
    await page.goto('/photography/pine-ridge/');
    const localDetail = await page.locator('[data-photo-viewer]').getAttribute('data-detail');
    const response = await context.request.get(localDetail!);
    const body = await response.body();
    await page.route('https://photos.amrithnath.dev/viewer-test.webp', route => route.fulfill({
      contentType: 'image/webp', body,
      headers: { 'access-control-allow-origin': cors ? '*' : 'https://not-allowed.example' },
    }));
    await page.locator('[data-photo-viewer]').evaluate(root => {
      (root as HTMLElement).dataset.detail = 'https://photos.amrithnath.dev/viewer-test.webp';
      root.querySelectorAll('source').forEach(source => source.remove());
      const display = root.querySelector('picture img') as HTMLImageElement;
      display.removeAttribute('srcset');
      display.src = 'https://photos.amrithnath.dev/viewer-test.webp';
    });
    await expect.poll(() => page.locator('picture img').evaluate(node =>
      (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: 'Open full-screen photo' }).click();
    await expect(page.locator('[data-photo-viewer]')).toHaveAttribute('data-renderer', cors ? 'webgl' : 'css');
    await expect(page.locator('[data-status]')).toBeEmpty();
    await page.keyboard.press('+');
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-scale', '1.250');
    await expect(page.locator('[data-preview]')).toBeVisible();
  });
}

test('detail network failure preserves the loaded display image', async ({ page }) => {
  await page.goto('/photography/pine-ridge/');
  await page.locator('[data-photo-viewer]').evaluate(root => {
    (root as HTMLElement).dataset.detail = '/missing-photo-detail.webp';
  });
  await page.route('**/missing-photo-detail.webp', route => route.abort());
  await page.getByRole('button', { name: 'Open full-screen photo' }).click();
  await expect(page.locator('[data-status]')).toContainText('showing the display image');
  await page.keyboard.press('+');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-scale', '1.250');
  expect(await page.locator('[data-preview]').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

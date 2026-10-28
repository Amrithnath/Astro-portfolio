import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { checkHtml, hashScript, inlineScripts, injectCsp, metaPolicies } from '../../scripts/csp.mjs';

test('hashes the exact browser script text and checks every intersecting policy', () => {
  const script = '\nconsole.log("safe");\n';
  const html = `<script>${script}</script>`;
  const policy = `script-src 'self' ${hashScript(script)}`;
  assert.deepEqual(checkHtml(html, [policy]), []);
  assert.match(checkHtml(html, [policy, "default-src 'self'"])[0], /unapproved/);
  assert.match(checkHtml(html.replace('safe', 'changed'), [policy])[0], /unapproved/);
  assert.equal(hashScript(script.replaceAll('\n', '\r\n')), hashScript(script));
});
test('ignores inert JSON-LD but checks modules and import maps', () => {
  const html = '<script type="application/ld+json">{"onload":"data"}</script><script type="module">run()</script><script type="importmap">{}</script>';
  assert.deepEqual(inlineScripts(html), ['run()', '{}']);
});
test('rejects handlers and javascript URLs, not strings inside scripts or data attributes', () => {
  assert.deepEqual(checkHtml('<script>const text = "onclick=foo";</script><div data-onclick="foo"></div>', []), []);
  assert.match(checkHtml('<img ONERROR="run()">', [])[0], /inline event handler/);
  assert.match(checkHtml('<a href="java&#x09;script:run()">bad</a>', [])[0], /javascript:/);
});

test('injection preserves script text, applies original offsets, and scopes search/admin policies', async () => {
  const directory = new URL(`./.build-fixture-${process.pid}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  try {
    await mkdir(new URL('search/', directory));
    await mkdir(new URL('admin/', directory));
    const script = 'const text = "<script> is text, not markup";';
    const html = `<html><head><meta charset="utf-8"><script>${script}</script><script data-cfasync="false" src="/main.js"></script></head><body><script type="application/ld+json">{}</script></body></html>`;
    await Promise.all(['index.html', 'search/index.html', 'admin/index.html'].map(path =>
      writeFile(new URL(path, directory), html)));
    await injectCsp(directory.pathname);
    const [page, search, admin] = await Promise.all(['index.html', 'search/index.html', 'admin/index.html'].map(path =>
      readFile(new URL(path, directory), 'utf8')));
    assert.deepEqual(inlineScripts(page), [script]);
    assert.equal((page.match(/data-cfasync="false"/g) || []).length, 3);
    assert.match(page, /<meta charset="utf-8"><meta http-equiv="Content-Security-Policy"/);
    assert.deepEqual(checkHtml(page, metaPolicies(page)), []);
    assert.ok(metaPolicies(page)[0].includes(hashScript(script)));
    assert.ok(!metaPolicies(page)[0].includes('wasm-unsafe-eval'));
    assert.ok(metaPolicies(search)[0].includes('wasm-unsafe-eval'));
    assert.deepEqual(metaPolicies(admin), []);
    assert.equal((admin.match(/data-cfasync="false"/g) || []).length, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

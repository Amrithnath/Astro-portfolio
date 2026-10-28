import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHtml, hashScript, inlineScripts } from '../../scripts/csp.mjs';

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

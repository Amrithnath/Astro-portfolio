import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('deployment headers keep the map, prints and XML feed noindex', () => {
  const { headers } = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const route of ['/photography/map/', '/photography/prints/', '/photography/rss.xml']) {
    const matching = headers.filter(({ source }) => new RegExp('^' + source + '$').test(route));
    assert.ok(matching.some((rule) => rule.headers.some(({ key, value }) =>
      key.toLowerCase() === 'x-robots-tag' && value.includes('noindex')
    )), route + ' must inherit noindex headers');
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseReleases } from '../../src/features/terminal/releases.ts';

const sample = `# Changelog

## [2.6.0](https://github.com/o/r/compare/v2.5.1...v2.6.0) (2026-10-28)


### ✨ Features

* **photos:** ✨ add a deep-zoom photo viewer ([e6e6398](https://github.com/o/r/commit/e6e6398))

## [2.5.1](https://github.com/o/r/compare/v2.5.0...v2.5.1) (2026-10-27)

### 🐛 Bug Fixes

* 🐛 fix things ([abcdef1](https://github.com/o/r/commit/abcdef1))

## [2.5.0](https://github.com/o/r/compare/v2.4.0...v2.5.0) (2026-10-26)
`;

test('reads version, date, release URL and first entry per release', () => {
  assert.deepEqual(parseReleases(sample, 2), [
    { version: '2.6.0', date: '2026-10-28', url: 'https://github.com/o/r/releases/tag/v2.6.0', summary: 'add a deep-zoom photo viewer' },
    { version: '2.5.1', date: '2026-10-27', url: 'https://github.com/o/r/releases/tag/v2.5.1', summary: 'fix things' },
  ]);
});

test('parses the real changelog', () => {
  const releases = parseReleases(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(releases.length > 0);
  for (const release of releases) assert.match(release.url, /\/releases\/tag\/v\d+\.\d+\.\d+$/);
});

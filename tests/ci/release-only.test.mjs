import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { isReleaseOnly } from '../../scripts/ci-release-only.mjs';

const repo = mkdtempSync(join(tmpdir(), 'release-only-'));
const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
  { cwd: repo, encoding: 'utf8' }).trim();
const write = (file, content) => writeFileSync(join(repo, file), content);
const pkg = (version, extra = {}) => `${JSON.stringify({ name: 'site', version, ...extra }, null, 2)}\n`;
const commit = files => {
  for (const [file, content] of Object.entries(files)) write(file, content);
  git('add', '-A');
  git('commit', '-qm', 'change');
  return git('rev-parse', 'HEAD');
};

git('init', '-q');
const base = commit({ 'package.json': pkg('1.0.0'), 'CHANGELOG.md': '# 1.0.0\n', 'index.astro': 'a' });
test.after(() => rmSync(repo, { recursive: true, force: true }));

test('a version bump with changelog and manifest is release-only', () => {
  const head = commit({ 'package.json': pkg('1.1.0'), 'CHANGELOG.md': '# 1.1.0\n', '.release-please-manifest.json': '{".":"1.1.0"}\n' });
  assert.equal(isReleaseOnly(base, head, repo), true);
});

test('other package.json edits or any other file run full CI', () => {
  const scripts = commit({ 'package.json': pkg('1.2.0', { scripts: { build: 'x' } }) });
  assert.equal(isReleaseOnly(base, scripts, repo), false);
  git('reset', '-q', '--hard', base);
  const source = commit({ 'CHANGELOG.md': '# 1.2.0\n', 'index.astro': 'b' });
  assert.equal(isReleaseOnly(base, source, repo), false);
});

test('missing, zero or identical revisions run full CI', () => {
  assert.equal(isReleaseOnly('', base, repo), false);
  assert.equal(isReleaseOnly('0000000000000000000000000000000000000000', base, repo), false);
  assert.equal(isReleaseOnly(base, base, repo), false);
});

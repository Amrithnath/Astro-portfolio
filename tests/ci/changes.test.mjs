import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { classify } from '../../scripts/ci-changes.mjs';

const repo = mkdtempSync(join(tmpdir(), 'ci-changes-'));
const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
  { cwd: repo, encoding: 'utf8' }).trim();
const pkg = (version, extra = {}) => `${JSON.stringify({ name: 'site', version, ...extra }, null, 2)}\n`;
const commit = files => {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), content);
  }
  git('add', '-A');
  git('commit', '-qm', 'change');
  return git('rev-parse', 'HEAD');
};

git('init', '-q');
const base = commit({ 'package.json': pkg('1.0.0'), 'CHANGELOG.md': '# 1.0.0\n', 'src/index.astro': 'a' });
const from = files => {
  git('reset', '-q', '--hard', base);
  return classify(base, commit(files), repo);
};
test.after(() => rmSync(repo, { recursive: true, force: true }));

test('a version bump with changelog and manifest is release-only', () => {
  assert.deepEqual(
    from({ 'package.json': pkg('1.1.0'), 'CHANGELOG.md': '# 1.1.0\n', '.release-please-manifest.json': '{".":"1.1.0"}\n' }),
    { release_only: true, site: true, code: false },
  );
});

test('docs-only changes skip site gates and CodeQL', () => {
  assert.deepEqual(from({ 'README.md': 'x', 'workers/views/README.md': 'x', LICENSE: 'x' }),
    { release_only: false, site: false, code: false });
});

test('workers and other workflows run CodeQL but not site gates', () => {
  assert.deepEqual(from({ 'workers/views/src/index.js': 'x', '.github/workflows/views.yml': 'x' }),
    { release_only: false, site: false, code: true });
});

test('site, CI pipeline, unknown and package.json edits run everything', () => {
  for (const file of ['src/pages/a.astro', 'src/content/blog/a.md', '.github/workflows/ci.yml', 'new-file.txt']) {
    assert.deepEqual(from({ [file]: 'x' }), { release_only: false, site: true, code: true }, file);
  }
  assert.equal(from({ 'package.json': pkg('1.2.0', { scripts: { build: 'x' } }) }).site, true);
});

test('missing, zero or identical revisions run everything', () => {
  for (const [b, h] of [['', base], ['0'.repeat(40), base], [base, base]]) {
    assert.deepEqual(classify(b, h, repo), { release_only: false, site: true, code: true });
  }
});

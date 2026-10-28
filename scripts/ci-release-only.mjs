// Prints `release_only=true` when BASE...HEAD only bumps the release version (the Release Please
// PR and its merge commit), so CI can skip gates that already passed for the same code.
// Usage: BASE=<sha> HEAD=<sha> node scripts/ci-release-only.mjs >> "$GITHUB_OUTPUT"
import { execFileSync } from 'node:child_process';

const releaseFiles = new Set(['CHANGELOG.md', 'package.json', '.release-please-manifest.json']);
export function isReleaseOnly(base, head, cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!base || !head || /^0+$/.test(base)) return false;
  const files = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
  if (!files.length || files.some(file => !releaseFiles.has(file))) return false;
  if (!files.includes('package.json')) return true;
  const mergeBase = git('merge-base', base, head).trim();
  const withoutVersion = ref => {
    const { version, ...rest } = JSON.parse(git('show', `${ref}:package.json`));
    return JSON.stringify(rest);
  };
  return withoutVersion(mergeBase) === withoutVersion(head);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let releaseOnly = false;
  try {
    releaseOnly = isReleaseOnly(process.env.BASE, process.env.HEAD);
  } catch (error) {
    // Unknown history (e.g. a force push): run every gate.
    console.error(`::warning::Release-only detection failed, running full CI: ${error.message}`);
  }
  console.log(`release_only=${releaseOnly}`);
}

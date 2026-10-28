// Classifies BASE...HEAD so CI runs only the gates a change can affect. Prints GitHub outputs:
// - release_only: the diff only bumps the release version (Release Please PR and its merge).
// - site: the diff can change the built site or its checks (build, Node 24, E2E, visual, Lighthouse).
// - code: the diff touches anything CodeQL scans (everything except docs and editor config).
// Unknown paths count as site changes, and any error runs every gate.
// Usage: BASE=<sha> HEAD=<sha> node scripts/ci-changes.mjs >> "$GITHUB_OUTPUT"
import { execFileSync } from 'node:child_process';

const releaseFiles = new Set(['CHANGELOG.md', 'package.json', '.release-please-manifest.json']);
const docs = [
  /^(?!src\/)(?:.*\/)?[^/]+\.md$/,
  /^(?:LICENSE|NOTICE)$/,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.(?:vscode|devcontainer)\//,
  /^\.(?:gitignore|prettierrc)$/,
];
// Code that never reaches dist/ and has its own workflow or check.
const nonSite = [
  /^\.github\/workflows\/(?!ci\.yml$)/,
  /^\.github\/dependabot\.yml$/,
  /^workers\//,
  /^project-archive\//,
  /^commitlint\.config\.mjs$/,
  /^release-please-config\.json$/,
  /^\.release-please-manifest\.json$/,
];
const matches = (patterns, file) => patterns.some(pattern => pattern.test(file));
const full = { release_only: false, site: true, code: true };

export function classify(base, head, cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!base || !head || /^0+$/.test(base)) return full;
  const files = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
  if (!files.length) return full;
  if (files.every(file => releaseFiles.has(file))) {
    const mergeBase = git('merge-base', base, head).trim();
    const withoutVersion = ref => {
      const { version, ...rest } = JSON.parse(git('show', `${ref}:package.json`));
      return JSON.stringify(rest);
    };
    if (!files.includes('package.json') || withoutVersion(mergeBase) === withoutVersion(head)) {
      // The version is rendered in the footer, so main still rebuilds and deploys.
      return { release_only: true, site: true, code: false };
    }
  }
  return {
    release_only: false,
    site: files.some(file => !matches(docs, file) && !matches(nonSite, file)),
    code: files.some(file => !matches(docs, file)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let result = full;
  try {
    result = classify(process.env.BASE, process.env.HEAD);
  } catch (error) {
    // Unknown history (e.g. a force push): run every gate.
    console.error(`::warning::Change detection failed, running full CI: ${error.message}`);
  }
  for (const [key, value] of Object.entries(result)) console.log(`${key}=${value}`);
}

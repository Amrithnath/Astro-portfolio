// Mirrors public/_headers and public/_redirects (Cloudflare Pages) into vercel.json, which Vercel needs for the same
// security headers. `node scripts/sync-vercel-headers.mjs` writes it; `--check` fails if stale.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const vercelPath = new URL('vercel.json', root);

const rules = [];
let rule;
for (const raw of readFileSync(new URL('public/_headers', root), 'utf8').split('\n')) {
  if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(raw)) {
    rule = { path: raw.trim(), headers: [], detach: [] };
    rules.push(rule);
    continue;
  }
  const line = raw.trim();
  if (line.startsWith('!')) rule.detach.push(line.slice(1).trim().toLowerCase());
  else {
    const i = line.indexOf(':');
    rule.headers.push({ key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
}

const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const toSource = (path) => path.split('*').map(escape).join('(.*)');

const headers = [];
for (const { path, headers: values } of rules) {
  // Absolute-URL rules target *.pages.dev previews only.
  if (!path.startsWith('/')) continue;
  // Headers another rule detaches (`! Name`) skip that rule's paths, mirroring Cloudflare.
  const detachedBy = rules.filter((r) => r.path.startsWith('/') && r.path !== path);
  const plain = [];
  const excluded = new Map();
  for (const header of values) {
    // Scoped overrides detach inherited global headers, not sibling route overrides.
    const owners = path === '/*'
      ? detachedBy.filter((r) => r.detach.includes(header.key.toLowerCase()))
      : [];
    if (!owners.length) {
      plain.push(header);
      continue;
    }
    const prefixes = owners.map((r) => escape(r.path.replace(/\*$/, '').replace(/^\//, '')));
    const source = `/((?!${prefixes.join('|')}).*)`;
    excluded.set(source, [...(excluded.get(source) || []), header]);
  }
  if (plain.length) headers.push({ source: toSource(path), headers: plain });
  for (const [source, list] of excluded) headers.push({ source, headers: list });
}

const redirects = readFileSync(new URL('public/_redirects', root), 'utf8').split('\n')
  .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [source, destination, status = '302'] = line.split(/\s+/);
    return { source, destination, statusCode: Number(status) };
  });
// Release Please PRs only bump versions; the post-merge main build deploys the release.
const git = { deploymentEnabled: { 'release-please--*': false } };
const json = `${JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json', git, headers, redirects }, null, 2)}\n`;
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(vercelPath, 'utf8');
  } catch {}
  if (current !== json) {
    console.error('vercel.json is out of sync with public/_headers. Run `pnpm sync:headers`.');
    process.exit(1);
  }
  console.log(`Header checks passed: vercel.json mirrors ${headers.length} public/_headers rules and ${redirects.length} redirects.`);
} else {
  writeFileSync(vercelPath, json);
  console.log(`Wrote vercel.json with ${headers.length} header rules.`);
}

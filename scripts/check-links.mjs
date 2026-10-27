// Verifies that every internal link/asset referenced by the built site resolves to a file in dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const site = 'https://amrithnath.dev';
// Wedding/photography routes are archived and intentionally excluded from validation.
const ignoredPrefixes = ['/wedding', '/photography'];

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const resolves = (pathname) => {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]);
  const target = join(dist, clean);
  if (clean.endsWith('/')) return existsSync(join(target, 'index.html'));
  return existsSync(target) || existsSync(`${target}.html`) || existsSync(join(target, 'index.html'));
};

const attr = /\s(?:href|src|content)="([^"]+)"|\ssrcset="([^"]+)"/g;
const broken = [];
let checked = 0;

for (const file of walk(dist).filter((path) => path.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(attr)) {
    const values = match[2] ? match[2].split(',').map((part) => part.trim().split(/\s+/)[0]) : [match[1]];
    for (const raw of values) {
      const value = raw.replace(/&amp;/g, '&');
      let pathname;
      if (value.startsWith(site)) pathname = new URL(value).pathname;
      else if (value.startsWith('/') && !value.startsWith('//')) pathname = value;
      else continue;
      if (ignoredPrefixes.some((prefix) => pathname.startsWith(prefix))) continue;
      // 404.html is served for arbitrary URLs; its canonical self-reference is not a navigable link.
      if (relative(dist, file) === '404.html' && pathname === '/404/') continue;
      checked++;
      if (!resolves(pathname)) broken.push(`${relative(dist, file)} -> ${value}`);
    }
  }
}

if (broken.length) {
  console.error(`Broken internal links (${broken.length}):\n${[...new Set(broken)].join('\n')}`);
  process.exit(1);
}
console.log(`Link checks passed: ${checked} internal references resolved.`);

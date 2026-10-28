import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attribute, checkHtml, directives, elements, htmlFiles, metaPolicies } from './csp.mjs';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const headerPolicy = headers.match(/^  Content-Security-Policy: (.+)$/m)[1];
const adminPolicy = headers.split('/admin/*')[1].match(/^  Content-Security-Policy: (.+)$/m)[1];
const errors = [];
const files = await htmlFiles(directory);
for (const path of files) {
  const html = await readFile(path, 'utf8');
  const admin = relative(directory, path).startsWith('admin/');
  const metas = metaPolicies(html);
  for (const script of elements(html).filter(node => node.tagName === 'script')) {
    if (attribute(script, 'data-cfasync') !== 'false') errors.push(`${path}: script must opt out of Rocket Loader`);
  }
  if (!admin) {
    if (metas.length !== 1) errors.push(`${path}: expected exactly one CSP meta`);
    if (!metas.some(meta => directives(meta).has('script-src'))) errors.push(`${path}: missing script-src`);
    const nodes = elements(html);
    const cspIndex = nodes.findIndex(node => node.tagName === 'meta' &&
      attribute(node, 'http-equiv')?.toLowerCase() === 'content-security-policy');
    if (nodes.some((node, i) => i < cspIndex && ['script', 'style', 'link'].includes(node.tagName))) {
      errors.push(`${path}: CSP must precede all executable/style resources`);
    }
  }
  for (const error of checkHtml(html, [admin ? adminPolicy : headerPolicy, ...metas])) errors.push(`${path}: ${error}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`CSP checks passed: ${files.length} HTML documents, response + meta policies, no inline handlers.`);

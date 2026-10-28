import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse } from 'parse5';

export const hashScript = (text) => `'sha256-${createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('base64')}'`;
export const directives = (policy) => new Map(policy.split(';').filter(s => s.trim()).map(s => {
  const [name, ...sources] = s.trim().split(/\s+/);
  return [name, sources];
}));

export function elements(html) {
  const result = [];
  const visit = (node) => {
    if (node.tagName) result.push(node);
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return result;
}
export const attribute = (node, name) => node.attrs.find(a => a.name === name)?.value;
export function inlineScripts(html, nodes = elements(html)) {
  return nodes.filter(node => node.tagName === 'script' && !attribute(node, 'src') &&
    // All non-JavaScript script types are inert data blocks, including JSON-LD.
    /^(?:module|importmap|speculationrules|(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/(?:javascript1\.[0-5]|jscript|livescript)|)$/i.test((attribute(node, 'type') || '').trim())
  ).map(node => {
    const { startTag, endTag } = node.sourceCodeLocation;
    return html.slice(startTag.endOffset, endTag?.startOffset ?? html.length);
  });
}
export async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}
export function metaPolicies(html) {
  return elements(html).filter(node => node.tagName === 'meta' &&
    attribute(node, 'http-equiv')?.toLowerCase() === 'content-security-policy')
    .map(node => attribute(node, 'content'));
}
export function checkHtml(html, policies, nodes = elements(html)) {
  const errors = [];
  for (const node of nodes) {
    for (const { name, value } of node.attrs) {
      if (/^on/i.test(name)) errors.push(`inline event handler ${name}`);
      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name) &&
          /^javascript:/i.test(value.replace(/[\u0000-\u0020]/g, ''))) errors.push('javascript: URL');
    }
  }
  for (const policy of policies) {
    const parsed = directives(policy);
    const sources = parsed.get('script-src-elem') ?? parsed.get('script-src') ?? parsed.get('default-src');
    if (!sources) continue;
    if (sources.includes("'unsafe-inline'")) errors.push('unsafe-inline script policy');
    for (const script of inlineScripts(html, nodes)) {
      if (!sources.includes(hashScript(script))) errors.push(`unapproved inline script ${hashScript(script)}`);
    }
  }
  return errors;
}
export async function injectCsp(directory) {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const template = headers.match(/^# HTML-CSP: (.+)$/m)?.[1];
  if (!template || !template.includes('HASHES')) throw new Error('Missing HTML-CSP template in public/_headers');
  const pages = [];
  const hashes = new Set();
  for (const path of await htmlFiles(directory)) {
    const html = await readFile(path, 'utf8');
    const nodes = elements(html);
    const edits = [];
    // Parse once: script attributes do not change script text or its CSP hash.
    for (const script of nodes.filter(node => node.tagName === 'script')) {
      if (attribute(script, 'data-cfasync') === 'false') continue;
      if (attribute(script, 'data-cfasync') !== undefined) throw new Error('Rocket Loader must stay disabled');
      edits.push({ offset: script.sourceCodeLocation.startTag.startOffset + '<script'.length,
        text: ' data-cfasync="false"' });
    }
    const admin = relative(directory, path).startsWith('admin/');
    if (!admin) for (const script of inlineScripts(html, nodes)) hashes.add(hashScript(script));
    pages.push({ path, html, nodes, edits, admin });
  }
  // A shared build-wide allowlist keeps one stable policy for every page and the deferred
  // terminal fragment without unsafe-inline or a mutable nonce.
  const sortedHashes = [...hashes].sort();
  const header = headers.match(/^  Content-Security-Policy: (.+)$/m)[1];
  const resources = header.split(';').map(s => s.trim()).filter(s =>
    s && !/^(?:frame-ancestors|upgrade-insecure-requests)\b/.test(s));
  const policy = [template.replace('HASHES', sortedHashes.join(' ')), ...resources].join('; ');
  // Pagefind compiles WebAssembly; allow it only on the unlisted search page.
  const searchPolicy = policy.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'");
  for (const { path, html, nodes, edits, admin } of pages) {
    if (admin) {
      await writeFile(path, applyEdits(html, edits));
      continue;
    }
    const page = /^search[\\/]/.test(relative(directory, path)) ? searchPolicy : policy;
    const head = nodes.find(node => node.tagName === 'head');
    if (!head?.sourceCodeLocation) throw new Error(`Missing head: ${path}`);
    const charset = nodes.find(node => node.tagName === 'meta' && attribute(node, 'charset'));
    // Keep charset inside the first 1024 bytes, ahead of the potentially long hash allowlist.
    const offset = (charset?.sourceCodeLocation ?? head.sourceCodeLocation).startTag.endOffset;
    const meta = `<meta http-equiv="Content-Security-Policy" content="${page}">`;
    const errors = checkHtml(html, [page], nodes);
    if (errors.length) throw new Error(`${path}: ${errors.join(', ')}`);
    edits.push({ offset, text: meta });
    await writeFile(path, applyEdits(html, edits));
  }
  console.log(`CSP: secured ${pages.filter(page => !page.admin).length} HTML documents with ${sortedHashes.length} script hashes.`);
}

function applyEdits(html, edits) {
  // Original parser offsets remain valid when insertions are applied back to front.
  for (const { offset, text } of edits.sort((a, b) => b.offset - a.offset)) {
    html = html.slice(0, offset) + text + html.slice(offset);
  }
  return html;
}

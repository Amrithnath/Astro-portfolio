import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(file, 'utf8');
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}
const files = htmlFiles('dist');
const versions = new Set();
for (const file of files) {
  const html = read(file);
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const ids = [...markup.matchAll(/<[a-z][^>]*\sid\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate IDs`);
  if (file.includes('/wedding/')) continue;
  assert.match(html, /<html\b[^>]*data-theme="terminal"/, `${file}: missing server theme`);
  assert.doesNotMatch(html, /professional-view|personal-view/, `${file}: removed views`);
  for (const match of html.matchAll(/(?:const|var) buildVersion = "([^"]+)"/g)) versions.add(match[1]);
}
assert.equal(versions.size, 1, 'All pages must register the same build version');
assert.match(read('dist/blog/index.html'), /0;url=\/blogs\//);
assert.match(read('dist/blogs/index.html'), /0;url=\/work-in-progress/);
const homepage = read('dist/index.html');
assert.equal([...homepage.matchAll(/class="terminal"/g)].length, 1, 'One homepage terminal shell');
const deferred = read('dist/terminal-full/index.html');
assert.match(deferred, /data-terminal-fragment/);
assert.doesNotMatch(deferred, /class="terminal"/, 'Deferred commands must not duplicate the shell');
const bootstrap = [...homepage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .find((match) => match[1].includes('window.__theme'))?.[1];
assert.ok(bootstrap, 'Missing inline theme bootstrap');
assert.ok(homepage.indexOf(bootstrap) < homepage.indexOf('</head>'), 'Bootstrap must run in head');

function themeContext(saved = {}, blocked = false) {
  const storage = new Map(Object.entries(saved));
  const listeners = new Map();
  const root = { dataset: { theme: 'terminal' }, style: {} };
  const meta = {};
  const context = {
    document: {
      documentElement: root,
      querySelector: () => ({ setAttribute: (key, value) => { meta[key] = value; } }),
    },
    localStorage: {
      getItem: (key) => { if (blocked) throw Error('Storage disabled'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw Error('Storage disabled'); storage.set(key, value); },
      removeItem: (key) => { if (blocked) throw Error('Storage disabled'); storage.delete(key); },
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: () => {},
    addEventListener: (type, callback) => listeners.set(type, callback),
  };
  context.window = context;
  vm.runInNewContext(bootstrap, context);
  return { context, root, storage, listeners, meta };
}
for (const saved of [
  {},
  { 'portfolio-theme': 'terminal' },
  { 'portfolio-layout-theme': 'terminal' },
  { 'portfolio-layout-theme': 'professional' },
  { 'portfolio-theme': 'personal', 'portfolio-layout-theme': 'terminal' },
  { 'portfolio-theme': '"><script>alert(1)</script>' },
]) {
  const { context, root, storage, listeners, meta } = themeContext(saved);
  assert.equal(root.dataset.theme, 'terminal');
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(meta.content, '#1e1e2e');
  assert.equal(storage.has('portfolio-layout-theme'), false);
  assert.equal(storage.get('portfolio-theme'), 'terminal');
  assert.equal(context.__theme.set('unknown'), false);
  assert.equal(context.__theme.set('terminal'), true);
  listeners.get('storage')({ key: 'portfolio-theme', newValue: 'invalid' });
  assert.equal(context.__theme.current, 'terminal');
}
assert.equal(themeContext({}, true).context.__theme.set('terminal'), true);

// Exercise the actual resume script against the real serialized build data without browser dependencies.
const resumeHtml = read('dist/resume/index.html');
const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const serialized = decode(resumeHtml.match(/data-resume="([^"]+)"/)[1]);
const resume = JSON.parse(serialized);
const elements = new Map();
for (const match of resumeHtml.matchAll(/\sid="([^"]+)"/g)) {
  elements.set(match[1], {
    id: match[1], dataset: {}, hidden: false, checked: true, handlers: {}, children: [],
    addEventListener(type, handler) { (this.handlers[type] ??= []).push(handler); },
    appendChild(child) { this.children.push(child); },
  });
}
elements.get('resume-generator').dataset.resume = serialized;
const blobs = [];
const downloads = [];
let printed = '';
let printCalls = 0;
const document = {
  readyState: 'loading',
  getElementById: (id) => elements.get(id),
  querySelector: (selector) => elements.get(selector.slice(1)),
  querySelectorAll: (selector) => selector.includes('section-toggles')
    ? [...elements.values()].filter((element) => element.id.startsWith('include-')) : [],
  addEventListener: () => {},
  body: { appendChild() {}, removeChild() {} },
  createElement: () => ({ click() { downloads.push(this.download); } }),
};
const context = vm.createContext({
  exports: {}, document, Blob, console, setTimeout: (callback) => callback(),
  URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:resume'; }, revokeObjectURL() {} },
  window: { open: () => ({
    document: { write: (html) => { printed = html; }, close() {} },
    focus() {}, print: () => { printCalls++; }, close() {},
  }) },
});
const script = read('src/components/ResumeGenerator.astro').match(/<script>([\s\S]*?)<\/script>/)[1];
const { outputText } = ts.transpileModule(script, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
vm.runInContext(outputText, context);
vm.runInContext('initResumeGenerator(); initResumeGenerator();', context);
const click = (id) => {
  const handlers = elements.get(id).handlers.click;
  assert.equal(handlers.length, 1, `${id}: handler must be bound once`);
  handlers[0]();
};
click('export-md');
let exported = await blobs.at(-1).text();
assert.ok(exported.includes(resume.contact.name));
assert.ok(exported.includes(resume.experience[0].company));
assert.ok(exported.includes(Object.values(resume.skills)[0][0]));
const toggle = elements.get('include-skills');
toggle.checked = false;
assert.equal(toggle.handlers.change.length, 1);
toggle.handlers.change[0]({ target: toggle });
assert.equal(elements.get('skills-section').hidden, true);
click('export-md');
assert.ok(!(await blobs.at(-1).text()).includes('## Skills & Technologies'));
// The CLI and checkbox controls must update the same section state.
elements.get('terminal-input').handlers.keypress[0]({ key: 'Enter', target: { value: '3' } });
assert.equal(toggle.checked, true);
assert.equal(elements.get('skills-section').hidden, false);
click('export-txt');
assert.ok((await blobs.at(-1).text()).includes('SKILLS & TECHNOLOGIES'));
assert.ok((await blobs.at(-1).text()).includes(resume.education[0].institution));
click('export-pdf');
assert.equal(printCalls, 1);
assert.ok(printed.includes(resume.contact.name));
assert.ok(printed.includes(resume.experience[0].company));
assert.deepEqual(downloads, ['resume.md', 'resume.md', 'resume.txt']);
console.log(`Theme checks passed: ${files.length} HTML files; storage/API, shared worker version, resume exports/toggles.`);

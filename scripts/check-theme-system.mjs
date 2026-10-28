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
  let markup = html;
  let previous;
  do {
    previous = markup;
    markup = markup.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\b[^>]*>/gi, '');
  } while (markup !== previous);
  const ids = [...markup.matchAll(/<[a-z][^>]*\sid\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate IDs`);
  if (file.includes('/admin/')) {
    assert.doesNotMatch(markup, /data-theme-switcher/, 'CMS must not render a theme switcher');
    continue;
  }
  if (file.includes('/wedding/')) continue;
  const shells = [...markup.matchAll(/class="terminal"/g)].length;
  assert.equal([...markup.matchAll(/data-theme-switcher/g)].length, shells,
    file + ': one switcher per shell (none on fragments/redirects)');
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
const bootstrap = [...homepage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)]
  .find((match) => match[1].includes('window.__theme'))?.[1];
assert.ok(bootstrap, 'Missing inline theme bootstrap');
assert.ok(homepage.indexOf(bootstrap) < homepage.indexOf('</head>'), 'Bootstrap must run in head');

const registry = {};
vm.runInNewContext(ts.transpileModule(read('src/themes/index.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: registry });

function themeContext(saved = {}, { blocked = false, light = false } = {}) {
  const storage = new Map(Object.entries(saved));
  const listeners = new Map();
  const events = [];
  const mediaListeners = [];
  const media = {
    matches: light,
    addEventListener(type, callback) {
      assert.equal(type, 'change');
      mediaListeners.push(callback);
    },
  };
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
    matchMedia: (query) => {
      assert.equal(query, '(prefers-color-scheme: light)');
      return media;
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: (event) => events.push(event),
    addEventListener: (type, callback) => {
      assert.equal(listeners.has(type), false, 'Only one global listener per event');
      listeners.set(type, callback);
    },
  };
  context.window = context;
  vm.runInNewContext(bootstrap, context);
  return {
    context, root, storage, listeners, meta, events,
    systemChange(light) {
      media.matches = light;
      mediaListeners.forEach(callback => callback({ matches: light }));
    },
  };
}
for (const light of [false, true]) {
  const systemTheme = light ? 'light' : 'terminal';
  for (const saved of [
    {},
    { 'portfolio-theme': 'terminal' },
    { 'portfolio-theme': 'light' },
    { 'portfolio-layout-theme': 'terminal' },
    { 'portfolio-layout-theme': 'light' },
    { 'portfolio-layout-theme': 'professional' },
    { 'portfolio-theme': 'personal', 'portfolio-layout-theme': 'terminal' },
    { 'portfolio-theme': 'auto' },
    { 'portfolio-theme': '"><script>alert(1)</script>' },
  ]) {
    const env = themeContext(saved, { light });
    const { context, root, storage, listeners, meta, events } = env;
    const explicit = registry.themes.find(theme => theme.id === saved['portfolio-theme'])?.id
      ?? (saved['portfolio-theme'] === undefined
        ? registry.themes.find(theme => theme.id === saved['portfolio-layout-theme'])?.id : undefined);
    const expected = explicit ?? systemTheme;
    const metadata = registry.themes.find(theme => theme.id === expected);
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, metadata.colorScheme);
    assert.equal(meta.content, metadata.themeColor);
    assert.equal(context.__theme.preference, explicit ?? 'auto');
    assert.equal(storage.has('portfolio-layout-theme'), false);
    assert.equal(storage.get('portfolio-theme'), explicit);
    const eventCount = events.length;
    assert.equal(context.__theme.set('unknown'), false);
    assert.equal(events.length, eventCount, 'Invalid IDs must not emit or mutate state');
    assert.equal(context.__theme.current, expected);
    for (const theme of registry.themes) {
      assert.equal(context.__theme.set(theme.id), true);
      assert.equal(context.__theme.current, theme.id);
      assert.equal(context.__theme.preference, theme.id);
      assert.equal(storage.get('portfolio-theme'), theme.id);
      assert.equal(events.at(-1).type, 'portfolio:theme-change');
      assert.equal(events.at(-1).detail.theme, theme.id);
      env.systemChange(!light);
      assert.equal(context.__theme.current, theme.id, 'Explicit preference ignores system changes');
    }
    assert.equal(context.__theme.auto(), true);
    assert.equal(context.__theme.preference, 'auto');
    assert.equal(storage.has('portfolio-theme'), false);
    env.systemChange(true);
    assert.equal(context.__theme.current, 'light');
    env.systemChange(false);
    assert.equal(context.__theme.current, 'terminal');
    listeners.get('storage')({ key: 'portfolio-theme', newValue: 'light' });
    assert.equal(context.__theme.current, 'light');
    assert.equal(context.__theme.preference, 'light');
    assert.equal(storage.has('portfolio-theme'), false, 'Storage sync must not write back');
    listeners.get('storage')({ key: 'portfolio-theme', newValue: 'invalid' });
    assert.equal(context.__theme.preference, 'auto');
    env.systemChange(true);
    listeners.get('storage')({ key: null, newValue: null });
    assert.equal(context.__theme.current, 'light');
    listeners.get('storage')({ key: 'portfolio-theme', newValue: null });
    assert.equal(context.__theme.preference, 'auto');
    listeners.get('storage')({ key: 'unrelated', newValue: 'terminal' });
    assert.equal(context.__theme.current, 'light');
  }
  const blocked = themeContext({}, { blocked: true, light });
  assert.equal(blocked.context.__theme.current, systemTheme);
  assert.equal(blocked.context.__theme.set('light'), true);
  assert.equal(blocked.context.__theme.current, 'light');
  blocked.context.__theme.auto();
  blocked.systemChange(!light);
  assert.equal(blocked.context.__theme.current, light ? 'terminal' : 'light');
  for (const preference of ['auto', ...registry.themes.map(theme => theme.id)]) {
    const swapped = themeContext({}, { light });
    swapped.context.__theme.set(preference);
    swapped.context.document.documentElement = { dataset: { theme: 'terminal' }, style: {} };
    const themeApi = swapped.context.__theme;
    vm.runInNewContext(bootstrap, swapped.context);
    assert.equal(swapped.context.__theme, themeApi, 'Swaps must reuse the API and listeners');
    assert.equal(themeApi.preference, preference);
    assert.equal(themeApi.current, preference === 'auto' ? systemTheme : preference);
    assert.equal(swapped.storage.has('portfolio-theme'), preference !== 'auto');
    swapped.systemChange(!light);
    assert.equal(themeApi.current, preference === 'auto' ? (light ? 'terminal' : 'light') : preference);
  }
}

const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (palette, foreground, background, id) => {
  const a = luminance(palette[foreground]);
  const b = luminance(palette[background]);
  assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
    `${id}: ${foreground} on ${background}: WCAG AA text contrast`);
};
const tokens = css => [...css.matchAll(/(--[a-z-]+):/g)].map(match => match[1]).sort();
const terminalTokens = tokens(read('src/styles/themes/terminal.css'));
for (const theme of registry.themes) {
  const css = read(`src/styles/themes/${theme.id}.css`);
  assert.ok(css.includes(`[data-theme='${theme.id}']`), `${theme.id}: scoped palette`);
  assert.deepEqual(tokens(css), terminalTokens, `${theme.id}: all palette tokens must be defined`);
  const palette = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/g)]
    .map(([, token, color]) => [token, color]));
  for (const foreground of ['text', 'muted', 'accent', 'link', 'secondary', 'heading', 'success', 'warning', 'danger', 'info']) {
    for (const background of ['bg', 'surface']) contrast(palette, foreground, background, theme.id);
  }
  for (const background of ['accent', 'link', 'success', 'danger', 'info']) {
    contrast(palette, 'on-accent', background, theme.id);
  }
}
for (const file of ['index.html', 'about/index.html', 'projects/index.html', 'contact/index.html', 'resume/index.html']) {
  const html = read(join('dist', file));
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /<main id="main-content" tabindex="-1"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one page heading`);
}

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
const script = read('src/components/ResumeGenerator.astro').match(/<script>([\s\S]*?)<\/script\b[^>]*>/i)[1];
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

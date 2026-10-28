import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const read = path => readFileSync(join('dist', path), 'utf8');
const htmlFiles = readdirSync('dist', { recursive: true }).filter(file => file.endsWith('.html'));
const head = html => html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
const ldBlocks = html => [...html.matchAll(
  /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi,
)].map(match => {
  assert.ok(!match[1].includes('<'), 'JSON-LD must escape HTML delimiters');
  return JSON.parse(match[1]);
});
const graphs = new Map();
let blocks = 0;
for (const file of htmlFiles) {
  const html = read(file);
  const parsed = ldBlocks(html);
  blocks += parsed.length;
  if (file === 'wedding/index.html') {
    assert.equal(parsed.length, 0, 'Wedding must not gain JSON-LD');
    assert.doesNotMatch(head(html), /rel="canonical"|name="twitter:|property="og:title"/);
    continue;
  }
  if (file === 'terminal-full/index.html') {
    assert.match(html, /name="robots" content="noindex, follow"/);
    assert.match(html, /data-terminal-fragment/);
    continue;
  }
  if (file === 'admin/index.html') {
    assert.equal(parsed.length, 0, 'CMS editor must not gain JSON-LD');
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    continue;
  }
  // Static service-worker fallback in public/; intentionally minimal and noindex.
  if (file === 'offline/index.html') {
    assert.match(html, /name="robots" content="noindex"/);
    continue;
  }
  const metadata = head(html);
  assert.ok(metadata, `Missing head: ${file}`);
  assert.equal(parsed.length, 1, `Expected one JSON-LD graph: ${file}`);
  const graph = parsed[0]['@graph'];
  graphs.set(file, graph);
  for (const type of ['Person', 'WebSite']) {
    assert.ok(graph.some(item => item['@type'] === type), `${file}: missing ${type}`);
  }
  assert.equal((metadata.match(/<title>/g) || []).length, 1, `${file}: duplicate title`);
  assert.equal((metadata.match(/name="description"/g) || []).length, 1);
  assert.match(metadata, /rel="canonical" href="https:\/\/amrithnath\.dev\//);
  for (const field of ['type', 'title', 'description', 'url', 'image', 'site_name']) {
    assert.ok(metadata.includes(`property="og:${field}"`), `${file}: missing OG ${field}`);
  }
  assert.match(metadata, /name="twitter:card"/);
  const image = metadata.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(image, `${file}: missing image URL`);
  assert.match(metadata, /property="og:image:width" content="1200"/);
  assert.match(metadata, /property="og:image:height" content="630"/);
  assert.match(metadata, /property="og:image:type" content="image\/png"/);
  assert.ok(metadata.includes(`name="twitter:image" content="${image}"`));
  const png = readFileSync(join('dist', new URL(image).pathname));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  // Detect failed bundled-font loading: the terminal background alone is not a valid card.
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let foreground = 0;
  for (let pixel = 0; pixel < data.length; pixel += info.channels) {
    if (Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) > 120) foreground++;
  }
  assert.ok(foreground > 1000, `${file}: OG text did not render`);
  if (/^(blog|project)\/.+\/index\.html$/.test(file)) {
    assert.notDeepEqual(png, readFileSync(join('dist/og/default.png')), `${file}: article OG card must differ from the default page card`);
  }
  assert.match(metadata, /title="LLMs"/);
  assert.match(metadata, /type="application\/rss\+xml"[^>]*href="https:\/\/amrithnath\.dev\/rss\.xml"/);
  const alternate = metadata.match(/type="text\/markdown"[^>]*href="([^"]+)"/);
  if (alternate) {
    assert.ok(existsSync(join('dist', new URL(alternate[1]).pathname)), alternate[1]);
  }
}
for (const file of ['index.html', 'about/index.html', 'resume/index.html']) {
  const graph = graphs.get(file);
  const person = graph.find(item => item['@type'] === 'Person');
  assert.ok(graph.some(item => item['@type'] === 'ProfilePage'));
  assert.ok(person.sameAs.some(url => hostIs(url, 'linkedin.com')));
  assert.ok(person.sameAs.some(url => hostIs(url, 'github.com')));
  assert.ok(person.alumniOf.length && person.worksFor.length && person.description);
  // Check real text nodes, not serialized data, attributes, scripts, or styles.
  const text = stripMarkup(read(file)).replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const value of [person.name, person.jobTitle, person.worksFor[0].name, 'Python']) {
    assert.ok(text.includes(value), `${file}: missing JavaScript-free content: ${value}`);
  }
}
assert.ok(graphs.get('blog/bluetooth-dystopia/index.html')
  .some(item => item['@type'] === 'BlogPosting'));
assert.ok(graphs.get('project/webDev/weather-app/index.html')
  .some(item => item['@type'] === 'SoftwareSourceCode'));
assert.match(readFileSync('src/pages/index.astro', 'utf8'), /fetch\('\/terminal-full\//);
assert.match(read('index.html'), /terminal-full/);
assert.ok(read('index.html').includes('Raspberry Pi Weather Station'));

const sitemap = read('sitemap-0.xml');
assert.match(read('sitemap-index.xml'), /https:\/\/amrithnath\.dev\/sitemap-0\.xml/);
assert.doesNotMatch(sitemap, /wedding|photograph|terminal-full|work-in-progress|404|\/blogs?\/<\/loc>/);
for (const file of ['404.html', 'work-in-progress/index.html', 'blog/index.html', 'blogs/index.html']) {
  assert.match(head(read(file)), /name="robots" content="noindex, follow"/);
}
// Unlisted pages ship to production but stay out of navigation and search until announced.
for (const unlisted of ['photography', 'now']) {
  for (const file of htmlFiles.filter(file => file.startsWith(unlisted + '/'))) {
    assert.match(head(read(file)), /name="robots" content="noindex, follow"/, file + ': must stay unlisted');
  }
  for (const file of htmlFiles.filter(file => !file.startsWith(`${unlisted}/`))) {
    assert.doesNotMatch(read(file), new RegExp(`href="(https://amrithnath\\.dev)?/${unlisted}`), `${file} links to unlisted /${unlisted}`);
  }
}
const robots = read('robots.txt');
for (const group of robots.split(/\n\n/).filter(group => group.startsWith('User-agent:'))) {
  assert.match(group, /Allow: \//);
  for (const path of ['/wedding', '/photography', '/now', '/admin', '/api', '/terminal-full', '/work-in-progress']) {
    assert.ok(group.includes(`Disallow: ${path}`), `${group.split('\n')[0]}: missing ${path}`);
  }
}
assert.match(robots, /User-agent: GPTBot/);
assert.match(robots, /User-agent: Claude-User/);
assert.match(robots, /User-agent: PerplexityBot/);
assert.match(robots, /Sitemap: https:\/\/amrithnath\.dev\/sitemap-index.xml/);
for (const file of ['llms.txt', 'llms-full.txt', 'index.md', 'about.md', 'resume.md', 'projects.md']) {
  const text = read(file);
  assert.match(text, /^# /);
  assert.doesNotMatch(text, /wedding|photograph|terminal-full|work-in-progress|Amrith Shanbhag/i);
  for (const [, href] of text.matchAll(/\]\((https:\/\/amrithnath\.dev[^)]+)\)/g)) {
    const path = new URL(href).pathname;
    const output = /\.[^/]+$/.test(path) ? path : `${path.replace(/\/$/, '')}/index.html`;
    assert.ok(existsSync(join('dist', output)), `${file}: broken local link: ${href}`);
  }
}
const rss = read('rss.xml');
assert.match(rss, /<rss[^>]*version="2\.0"/);
assert.match(rss, /<channel>/);
assert.match(read('llms.txt'), /https:\/\/amrithnath\.dev\/rss\.xml/);
assert.match(robots, /# RSS feed: https:\/\/amrithnath\.dev\/rss\.xml/);
for (const [file, graph] of graphs) {
  const article = graph.find(item => ['BlogPosting', 'SoftwareSourceCode'].includes(item['@type']));
  if (!article) continue;
  assert.ok(Number.isFinite(Date.parse(article.datePublished)), `${file}: invalid publication date`);
  if (article.dateModified) {
    assert.ok(Number.isFinite(Date.parse(article.dateModified)), `${file}: invalid updated date`);
  }
  assert.ok(sitemap.includes(article.url), `${file}: missing article in sitemap`);
  if (article['@type'] === 'BlogPosting') {
    assert.ok(rss.includes(`<link>${article.url}</link>`), `${file}: missing blog post in RSS`);
    assert.ok(rss.includes(`<pubDate>${new Date(article.datePublished).toUTCString()}</pubDate>`));
  }
}
assert.match(read('blog/bluetooth-dystopia.md'), /## Innovation/);
assert.match(read('project/webDev/weather-app.md'), /Project description coming soon/);
console.log(`SEO checks passed: ${htmlFiles.length} HTML files, ${blocks} JSON-LD blocks parsed; crawl policy, raw profile text, sitemap, RSS, article dates, and Markdown verified.`);

function hostIs(url, domain) {
  try {
    const { hostname } = new URL(url);
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function stripMarkup(html) {
  let text = html;
  let previous;
  do {
    previous = text;
    text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\b[^>]*>/gi, '');
  } while (text !== previous);
  return text.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ');
}

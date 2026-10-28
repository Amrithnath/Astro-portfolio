import type { APIRoute, GetStaticPaths } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import terminalTheme from '../../features/theme/styles/themes/terminal.css?raw';
import { contentPath, getPublishedCollection } from '../../features/content/content';
import { ogHeight, ogPages, ogWidth } from '../../features/seo/og';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const articles = [
    ...await getPublishedCollection('blog'),
    ...await getPublishedCollection('projects'),
  ].map(entry => ({
    path: contentPath(entry),
    title: entry.data.title,
    entry,
  }));
  const pages = Object.entries(ogPages).map(([path, title]) => ({ path, title, entry: undefined }));
  return [...pages, ...articles, { path: '/default', title: 'Portfolio', entry: undefined }].map(({ path, title, entry }) => ({
    params: { slug: path === '/' ? 'index' : path.slice(1) },
    props: { title, entry },
  }));
};

const escape = (text: string) => text.replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[char]!);

const safeText = (value: unknown) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f\u200d\ufe0e\ufe0f]/g, '')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/[^\x20-\x7e]/g, '?')
  .replace(/\s+/g, ' ')
  .trim();

function wrap(value: string, width: number, maxLines: number) {
  const words = safeText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const chunks = word.match(new RegExp(`.{1,${width}}`, 'g')) || [''];
    for (const chunk of chunks) {
      if (line && `${line} ${chunk}`.length > width) {
        lines.push(line);
        line = '';
      }
      if (line) line += ' ';
      line += chunk;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, width - 1)).trimEnd()}…`;
  }
  return lines;
}

const color = (token: string) => terminalTheme.match(new RegExp(`--color-${token}:\\s*([^;]+);`))![1];

async function localCoverData(image: unknown): Promise<string | undefined> {
  if (typeof image !== 'string' || !image.startsWith('/') || image.startsWith('//')) return undefined;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(image, 'https://portfolio.local').pathname);
  } catch {
    return undefined;
  }
  const publicRoot = resolve('public');
  const file = resolve(publicRoot, `.${pathname}`);
  const fromRoot = relative(publicRoot, file);
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return undefined;
  try {
    const input = await readFile(file);
    const output = await sharp(input).resize(360, 270, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 76 }).toBuffer();
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function renderArticleCard(title: string, entry: any, cover?: string) {
  const data = entry.data;
  const hasCover = Boolean(cover);
  const titleLines = wrap(title, hasCover ? 22 : 36, 3);
  const descriptionLines = wrap(data.description, hasCover ? 48 : 68, 2);
  const titleSvg = titleLines.map((line, index) =>
    `<text x="80" y="${210 + index * 58}">${escape(line)}</text>`,
  ).join('');
  const descriptionStart = Math.max(330, 210 + titleLines.length * 58 + 32);
  const descriptionSvg = descriptionLines.map((line, index) =>
    `<text x="80" y="${descriptionStart + index * 34}">${escape(line)}</text>`,
  ).join('');
  const isBlog = entry.collection === 'blog';
  const prompt = `amrith@portfolio:~ $ cat ${isBlog ? 'blog' : 'projects'}/${entry.id}.md`;
  const promptLine = wrap(prompt, 78, 1)[0] || prompt;
  let meta: string[];
  if (isBlog) {
    const body = String(entry.body || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~]/g, ' ');
    const words = safeText(body).split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    const date = data.pubDate.toISOString().slice(0, 10);
    meta = [date, `${minutes} min read`, ...(data.tags || []).slice(0, 3).map((tag: string) => `#${tag}`)];
  } else {
    meta = (data.tech?.length ? data.tech : data.tags || []).slice(0, 4).map((tech: string) => `#${tech}`);
    if (!meta.length) meta = ['project'];
  }
  const metaText = wrap(meta.join('  |  '), hasCover ? 58 : 78, 1)[0] || '';
  const thumbnail = cover
    ? `<rect x="850" y="158" width="270" height="220" rx="12" fill="${color('border')}"/><image href="${cover}" x="856" y="164" width="258" height="208" preserveAspectRatio="xMidYMid slice"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidth}" height="${ogHeight}" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${color('bg')}"/>
    <rect x="32" y="32" width="1136" height="566" rx="16" fill="${color('surface')}"/>
    <g font-family="Fira Code" fill="${color('text')}">
      <text x="80" y="92" font-size="23" fill="${color('accent')}">${escape(safeText(promptLine))}</text>
      ${thumbnail}
      <g font-size="44" font-weight="600" fill="${color('link')}">${titleSvg}</g>
      <g font-size="22" fill="${color('heading')}">${descriptionSvg}</g>
      <text x="80" y="520" font-size="18" fill="${color('accent')}">${escape(metaText)}</text>
      <text x="80" y="565" font-size="21" fill="${color('accent')}">amrithnath.dev<tspan fill="${color('text')}"> / portfolio.sh</tspan></text>
    </g>
  </svg>`;
}

export const GET: APIRoute = async ({ props }) => {
  const { title } = props as { title: string; entry?: any };
  const entry = (props as { entry?: any }).entry;
  let svg: string;
  if (entry) {
    const cover = await localCoverData(entry.data.img || entry.data.image);
    svg = renderArticleCard(title, entry, cover);
  } else {
    const words = String(title).split(/\s+/);
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.length - 1;
      if (last < 0 || `${lines[last]} ${word}`.length > 32) lines.push(word);
      else lines[last] += ` ${word}`;
    }
    const titleSvg = lines.slice(0, 3).map((line, index) =>
      `<text x="80" y="${305 + index * 64}">${escape(line.slice(0, 34))}${index === 2 && lines.length > 3 ? '…' : ''}</text>`,
    ).join('');
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidth}" height="${ogHeight}" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${color('bg')}"/>
      <rect x="32" y="32" width="1136" height="566" rx="16" fill="${color('surface')}"/>
      <g font-family="Fira Code" fill="${color('text')}">
        <text x="80" y="92" font-size="24" fill="${color('accent')}">amrith@portfolio:~ $ cat page.md</text>
        <text x="80" y="165" font-size="34">Amrithnath Vijayakumar</text>
        <text x="80" y="210" font-size="26" fill="${color('heading')}">Senior Engineer — Platform Engineering</text>
        <g font-size="48" font-weight="600" fill="${color('link')}">${titleSvg}</g>
        <text x="80" y="552" font-size="24" fill="${color('accent')}">amrithnath.dev<tspan fill="${color('text')}"> / portfolio.sh</tspan></text>
      </g>
    </svg>`;
  }
  const png = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: [resolve('src/assets/fonts/FiraCode.ttf')] },
  }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};

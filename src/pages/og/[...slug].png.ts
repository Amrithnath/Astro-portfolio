import type { APIRoute, GetStaticPaths } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import { resolve } from 'node:path';
import terminalTheme from '../../styles/themes/terminal.css?raw';
import { contentPath, getPublishedCollection } from '../../lib/content';
import { ogHeight, ogPages, ogWidth } from '../../lib/og';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = [
    ...Object.entries(ogPages),
    ...[...await getPublishedCollection('blog'), ...await getPublishedCollection('projects')]
      .map(entry => [contentPath(entry), entry.data.title]),
    ['/default', 'Portfolio'],
  ];
  return entries.map(([path, title]) => ({
    params: { slug: path === '/' ? 'index' : path.slice(1) },
    props: { title },
  }));
};

const escape = (text: string) => text.replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[char]!);

export const GET: APIRoute = ({ props }) => {
  const words = String(props.title).split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last < 0 || `${lines[last]} ${word}`.length > 32) lines.push(word);
    else lines[last] += ` ${word}`;
  }
  const title = lines.slice(0, 3).map((line, index) =>
    `<text x="80" y="${305 + index * 64}">${escape(line.slice(0, 34))}${index === 2 && lines.length > 3 ? '…' : ''}</text>`
  ).join('');
  const color = (token: string) => terminalTheme.match(new RegExp(`--color-${token}:\\s*([^;]+);`))![1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidth}" height="${ogHeight}" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${color('bg')}"/>
    <rect x="32" y="32" width="1136" height="566" rx="16" fill="${color('surface')}"/>
    <g font-family="Fira Code" fill="${color('text')}">
      <text x="80" y="92" font-size="24" fill="${color('accent')}">amrith@portfolio:~ $ cat page.md</text>
      <text x="80" y="165" font-size="34">Amrithnath Vijayakumar</text>
      <text x="80" y="210" font-size="26" fill="${color('heading')}">Senior Engineer — Platform Engineering</text>
      <g font-size="48" font-weight="600" fill="${color('link')}">${title}</g>
      <text x="80" y="552" font-size="24" fill="${color('accent')}">amrithnath.dev<tspan fill="${color('text')}"> / portfolio.sh</tspan></text>
    </g>
  </svg>`;
  const png = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: [resolve('src/assets/fonts/FiraCode.ttf')] },
  }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};

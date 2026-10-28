import type { APIRoute } from 'astro';
import { excludedPrefixes } from '../features/seo/seo';

export const prerender = true;
export const GET: APIRoute = ({ site }) => {
  const agents = [
    '*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
    'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User',
    'Googlebot', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'CCBot',
    'Amazonbot', 'Bytespider', 'FacebookBot', 'meta-externalagent',
    'meta-externalfetcher', 'cohere-ai', 'Diffbot', 'YouBot',
  ];
  // One group with multiple user-agent lines (RFC 9309); named agents would not inherit '*'.
  const group = [
    ...agents.map(agent => `User-agent: ${agent}`),
    'Allow: /',
    ...excludedPrefixes.map(path => `Disallow: ${path}`),
  ].join('\n');
  return new Response([
    '# Public portfolio: search, training, and user-fetch agents are welcome.',
    `# LLM discovery: ${new URL('/llms.txt', site).href}`,
    `# RSS feed: ${new URL('/rss.xml', site).href}`,
    group,
    `Sitemap: ${new URL('/sitemap-index.xml', site).href}`,
    '',
  ].join('\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

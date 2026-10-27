import type { APIRoute } from 'astro';
import { fullProfileMarkdown } from '../lib/profile-markdown';

export const prerender = true;
export const GET: APIRoute = ({ site }) => new Response(fullProfileMarkdown(site!), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

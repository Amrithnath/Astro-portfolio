import type { APIRoute } from 'astro';
import { fullProfileMarkdown, getPosts } from '../lib/profile-markdown';

export const prerender = true;
export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const notes = posts.map(post => [
    `## ${post.title}`, post.description,
    `Canonical page: ${new URL(`${post.path}/`, site).href}`, post.body,
  ].join('\n\n')).join('\n\n');
  return new Response(`${fullProfileMarkdown(site!)}\n## Writing and project notes\n\n${notes}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

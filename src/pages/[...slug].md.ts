import type { APIRoute, GetStaticPaths } from 'astro';
import { fullProfileMarkdown, markdownMirrors } from '../lib/profile-markdown';

export const prerender = true;
export const getStaticPaths: GetStaticPaths = () => markdownMirrors().map(page => ({
  params: { slug: page.slug }, props: page,
}));

export const GET: APIRoute = ({ props, site }) => {
  const canonical = new URL(props.path === '/' ? '/' : `${props.path}/`, site).href;
  const body = props.slug === 'resume' ? fullProfileMarkdown(site!) : props.body;
  return new Response(`${body}\n\nCanonical page: ${canonical}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};

import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { contentPath, getPublishedCollection } from '../lib/content';
import { profile } from '../lib/seo';

export const prerender = true;
export const GET: APIRoute = async ({ site }) => {
  const posts = await getPublishedCollection('blog');
  return rss({
    title: `${profile.contact.name}'s blog`,
    description: profile.summary,
    site: site!,
    items: posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map(post => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        categories: post.data.tags,
        link: `${contentPath(post)}/`,
      })),
  });
};

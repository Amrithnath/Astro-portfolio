import rss from '@astrojs/rss';
import { getImage } from 'astro:assets';
import type { APIRoute } from 'astro';
import { getPhotos } from '../../features/content/content';
import { newestPublishedPhotos, remoteImage } from '../../features/photos/photos';
import { profile } from '../../features/seo/seo';

export const prerender = true;
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]!);

export const GET: APIRoute = async ({ site }) => {
  const photos = newestPublishedPhotos(await getPhotos());
  const items = await Promise.all(photos.map(async ({ id, data }) => {
    const image = data.remote
      ? remoteImage(data.remote).src
      : data.image && (await getImage({
          src: data.image,
          width: Math.min(1200, data.image.width),
          format: 'webp',
        })).src;
    return {
      title: data.title,
      link: `/photography/${id}/`,
      description: data.caption ?? data.alt,
      pubDate: data.date,
      categories: data.tags,
      customData: image
        ? `<media:content url="${escapeXml(new URL(image, site).href)}" type="image/webp" medium="image" />`
        : undefined,
    };
  }));
  return rss({
    title: `${profile.contact.name}'s photography`,
    description: 'Published photographs. All rights reserved unless stated otherwise.',
    site: new URL('/photography/', site!).href,
    xmlns: { media: 'http://search.yahoo.com/mrss/' },
    items,
  });
};

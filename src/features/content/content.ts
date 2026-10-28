import { assertPhotoIds } from '../photos/photos';
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

export function getPublishedCollection<C extends Exclude<CollectionKey, 'now' | 'uses'>>(collection: C) {
  return getCollection(collection, ({ data }) => !import.meta.env.PROD || !data.draft);
}

export function contentPath(entry: CollectionEntry<'blog' | 'projects'>): string {
  return `/${entry.collection === 'blog' ? 'blog' : 'project'}/${entry.id}`;
}

export async function getProjectWriteups(projectId: string) {
  const posts = await getPublishedCollection('blog');
  return posts
    .filter(post => post.data.project?.id === projectId)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getProjectPreviews() {
  const projects = await getPublishedCollection('projects');
  return Promise.all(projects
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map(async entry => ({
      frontmatter: entry.data,
      url: `${contentPath(entry)}/`,
      id: entry.id,
      writeups: await getProjectWriteups(entry.id),
    })));
}
// Featured photos first, then newest; undated photos keep file order at the end.
export async function getPhotos() {
  const photos = await getPublishedCollection('photos');
  assertPhotoIds(photos);
  return photos.sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );
}

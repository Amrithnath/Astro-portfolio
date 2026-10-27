import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

export function getPublishedCollection<C extends CollectionKey>(collection: C) {
  return getCollection(collection, ({ data }) => !import.meta.env.PROD || !data.draft);
}

export function contentPath(entry: CollectionEntry<'blog' | 'projects'>): string {
  return `/${entry.collection === 'blog' ? 'blog' : 'project'}/${entry.id}`;
}

export async function getProjectPreviews() {
  const projects = await getPublishedCollection('projects');
  return projects.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map(entry => ({ frontmatter: entry.data, url: `${contentPath(entry)}/` }));
}

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Absolute URL or a site-relative path such as /images/blog/cover.jpg (CMS uploads).
const imageSource = z.union([z.url(), z.string().regex(/^\/(?![/\\])/)]);

const articleSchema = z.object({
  title: z.string(),
  description: z.string().trim(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  img: imageSource.optional(),
  image: imageSource.optional(),
  lang: z.string().optional(),
});

const loader = (base: string) =>
  glob({
    base,
    pattern: '**/*.md',
    // Preserve path casing (notably webDev/) for existing canonical URLs.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  });

const blog = defineCollection({
  loader: loader('./src/content/blog'),
  schema: articleSchema,
});

const projects = defineCollection({
  loader: loader('./src/content/projects'),
  schema: articleSchema.extend({
    link: z.url().optional(),
    client: z.string().optional(),
    github: z.url().optional(),
    live: z.url().optional(),
    demo: z.url().optional(),
    tech: z.array(z.string()).optional(),
  }),
});

export const collections = { blog, projects };

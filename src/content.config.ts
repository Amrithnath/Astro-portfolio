import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { coarseCoordinate, normalizeTags } from './features/photos/photos';
import { isGoogleMapsUrl, isShortMapsUrl, parseGoogleMapsUrl } from './features/photos/geo';

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
  schema: articleSchema.extend({ project: reference('projects').optional() }),
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
    status: z.enum(['active', 'maintained', 'archived', 'concept']).optional(),
    featured: z.boolean().default(false),
  }),
});

// Unlisted photography: Astro optimizes local assets; R2 entries reference stripped derivatives.
const photos = defineCollection({
  loader: glob({ base: './src/content/photos', pattern: '**/*.{yml,yaml}' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        image: image().optional(),
        remote: z
          .object({
            key: z.string().regex(/^[a-z0-9][a-z0-9/-]*$/),
            width: z.number().int().positive(),
            height: z.number().int().positive(),
            placeholder: z
              .string()
              .regex(
                /^(?:#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([0-9.,%+\s/-]+\))$/i
              )
              .optional(),
          })
          .optional(),
        alt: z.string().trim().min(1),
        caption: z.string().optional(),
        location: z
          .object({
            name: z.string().trim().min(1).optional(),
            region: z.string().trim().min(1).optional(),
            country: z.string().trim().min(1).optional(),
            lat: z
              .number()
              .min(-90)
              .max(90)
              .refine(coarseCoordinate, {
                message: 'Coordinates must have at most 2 decimal places',
              })
              .optional(),
            lng: z.number().min(-180).max(180).refine(coarseCoordinate).optional(),
            // A pasted Google Maps link fills in a missing name and coordinates (rounded). The link
            // itself is never rendered.
            maps: z.url().refine(isGoogleMapsUrl, { message: 'Use a Google Maps link' }).optional(),
          })
          .transform(({ maps, ...place }, ctx) => {
            const fromLink = maps ? parseGoogleMapsUrl(maps) : undefined;
            const hasCoordinates = place.lat !== undefined && place.lng !== undefined;
            const location = {
              ...place,
              name: place.name ?? fromLink?.name,
              ...(!hasCoordinates && fromLink?.lat !== undefined
                ? { lat: fromLink.lat, lng: fromLink.lng }
                : {}),
            };
            if (!location.name) {
              ctx.issues.push({
                code: 'custom',
                input: maps,
                message:
                  maps && isShortMapsUrl(maps)
                    ? 'Short Maps links need resolving: run `pnpm photos:locate` (or the Locate photos workflow), or add a place name'
                    : 'Add a place name, or a Google Maps link that names the place',
              });
              return z.NEVER;
            }
            return location as typeof location & { name: string };
          })
          .optional(),
        date: z.coerce.date().optional(),
        camera: z.string().optional(),
        lens: z.string().optional(),
        settings: z.string().optional(),
        focalLength: z.number().positive().optional(),
        aperture: z.number().positive().optional(),
        exposureTime: z.number().positive().optional(),
        iso: z.number().int().positive().optional(),
        tags: z.array(z.string()).default([]).transform(normalizeTags),
        albums: z.array(reference('albums')).default([]),
        featured: z.boolean().default(false),
        draft: z.boolean().default(false),
      })
      .refine((data) => Boolean(data.image) !== Boolean(data.remote), {
        message: 'Provide exactly one of image or remote',
      }),
});

const albums = defineCollection({
  loader: glob({ base: './src/content/albums', pattern: '**/*.{yml,yaml}' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      kind: z.enum(['album', 'trip']).default('album'),
      cover: reference('photos').optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      stops: z
        .array(
          z.object({
            name: z.string(),
            country: z.string(),
            region: z.string().optional(),
            date: z.coerce.date().optional(),
          })
        )
        .default([]),
      draft: z.boolean().default(false),
    })
    .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
      message: 'Trip endDate must not precede startDate',
    }),
});

// Single-entry collection for the unlisted /now page (src/content/now/now.md).
const now = defineCollection({
  loader: glob({ base: './src/content/now', pattern: 'now.md' }),
  schema: z.object({
    updated: z.coerce.date(),
    location: z.string().optional(),
    placeholder: z.boolean().default(false),
  }),
});

// Single-entry collection for the unlisted /uses page (src/content/uses/uses.md).
const uses = defineCollection({
  loader: glob({ base: './src/content/uses', pattern: 'uses.md' }),
  schema: z.object({
    updated: z.coerce.date(),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { blog, projects, photos, albums, now, uses };

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile, access } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import exifr from 'exifr';
import { AwsClient } from 'aws4fetch';
import { stringify } from 'yaml';
import { derivativeWidths } from '../src/data/photos-config.ts';
import { normalizeTags, reservedPhotoIds, shutterSpeed, slugify } from '../src/lib/photos.ts';
import {
  isGoogleMapsUrl,
  isShortMapsUrl,
  parseGoogleMapsUrl,
  resolveGoogleMapsUrl,
  reverseGeocode,
} from '../src/lib/geo.ts';

const imagePattern = /\.(jpe?g|png|tiff?|webp|avif|heic)$/i;
const round = (value) => Math.round(value * 100) / 100;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let lastGeocode = 0;
// Nominatim allows at most one request per second.
async function politeReverseGeocode(coordinates, fetchImpl) {
  await sleep(Math.max(0, lastGeocode + 1100 - Date.now()));
  lastGeocode = Date.now();
  try {
    return await reverseGeocode(coordinates, fetchImpl);
  } catch (error) {
    console.warn('Reverse geocoding failed: ' + error.message);
    return undefined;
  }
}
/**
 * Builds the coarse location for an entry. A Maps link wins over EXIF GPS; names come from the
 * link or, when geocoding is enabled, from OpenStreetMap. Unknown names stay as a TODO for review.
 */
export async function locate(exif, { maps, geocode = false, fetchImpl = fetch } = {}) {
  let place = {};
  if (maps) {
    if (!isGoogleMapsUrl(maps)) throw new Error('--maps must be a Google Maps link');
    place = (isShortMapsUrl(maps) ? await resolveGoogleMapsUrl(maps, fetchImpl) : parseGoogleMapsUrl(maps)) ?? {};
    if (place.lat === undefined && place.name === undefined)
      throw new Error('Could not read a place from the Google Maps link');
  } else if (Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude)) {
    place = { lat: round(exif.latitude), lng: round(exif.longitude) };
  }
  if (geocode && place.lat !== undefined) {
    const found = await politeReverseGeocode({ lat: place.lat, lng: place.lng }, fetchImpl);
    place = { ...found, ...place, name: place.name ?? found?.name };
  }
  if (place.lat === undefined && place.name === undefined) return undefined;
  const { name, region, country, lat, lng } = place;
  return {
    name: name ?? 'TODO place name',
    ...(region ? { region } : {}),
    ...(country ? { country } : {}),
    ...(lat !== undefined ? { lat, lng } : {}),
  };
}
function exposureFields(exif) {
  return Object.fromEntries(
    [
      ['focalLength', exif.FocalLength],
      ['aperture', exif.FNumber],
      ['exposureTime', exif.ExposureTime],
      ['iso', exif.ISO],
    ].filter(([key, value]) =>
      Number.isFinite(value) && value > 0 && (key !== 'iso' || Number.isInteger(value))
    )
  );
}
export function settingsFromExif(exif) {
  const { focalLength, aperture, exposureTime, iso } = exposureFields(exif);
  return [
    focalLength && round(focalLength) + 'mm',
    aperture && 'f/' + aperture,
    exposureTime && shutterSpeed(exposureTime),
    iso && 'ISO ' + iso,
  ]
    .filter(Boolean)
    .join(' · ');
}
export function metadataFromExif(exif) {
  const camera = [...new Set([exif.Make, exif.Model].filter(Boolean))].join(' ');
  const date = exif.DateTimeOriginal;
  return {
    ...(date instanceof Date && Number.isFinite(date.valueOf()) ? { date: date.toISOString() } : {}),
    ...(camera ? { camera } : {}),
    ...(exif.LensModel ? { lens: String(exif.LensModel) } : {}),
    ...exposureFields(exif),
    ...(settingsFromExif(exif) ? { settings: settingsFromExif(exif) } : {}),
  };
}

function r2() {
  for (const name of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_BUCKET',
  ]) {
    if (!process.env[name]) throw new Error(`Missing ${name}; use --dry-run locally`);
  }
  if (process.env.R2_INBOX_BUCKET === process.env.R2_PUBLIC_BUCKET) {
    throw new Error('Inbox and public buckets must be different');
  }
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const url = (bucket, key = '') =>
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return async (bucket, key, options = {}, query = '') => {
    const response = await client.fetch(url(bucket, key) + query, options);
    if (!response.ok) throw new Error(`R2 ${options.method ?? 'GET'} failed (${response.status})`);
    return response;
  };
}
export async function ingestFile(file, options = {}) {
  const {
    dryRun = false,
    out = '.photos-output',
    contentDir = 'src/content/photos',
    album,
    tags = [],
    maps,
    geocode = !dryRun,
    fetchImpl = fetch,
  } = options;
  const slug = slugify(basename(file, extname(file)));
  if (!slug || reservedPhotoIds.includes(slug))
    throw new Error(`Reserved or invalid photo slug: ${slug}`);
  if (album && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album)) throw new Error('Invalid album slug');
  await mkdir(contentDir, { recursive: true });
  const entry = join(contentDir, `${slug}.yml`);
  for (const extension of ['yml', 'yaml']) {
    try {
      await access(join(contentDir, `${slug}.${extension}`));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    throw new Error(`Refusing to overwrite existing photo: ${slug}`);
  }
  const original = await readFile(file);
  const exif = (await exifr.parse(original, { gps: true })) ?? {};
  // Auto-orient before determining dimensions; no metadata is retained by sharp's defaults.
  const oriented = await sharp(original).rotate().raw().toBuffer({ resolveWithObject: true });
  const metadata = oriented.info;
  const source = () => sharp(oriented.data, { raw: oriented.info });
  const { dominant } = await source().stats();
  const placeholder =
    '#' + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const key = `${slug}/${createHash('sha256').update(original).digest('hex').slice(0, 16)}`;
  const upload = dryRun ? undefined : r2();
  const widths = [...new Set(derivativeWidths.map((w) => Math.min(w, metadata.width)))];
  for (const width of widths) {
    for (const format of ['avif', 'webp']) {
      const buffer = await source()
        .resize({ width, withoutEnlargement: true })
        .toFormat(format)
        .toBuffer();
      const objectKey = `${key}/${width}.${format}`;
      if (dryRun) {
        const target = join(out, objectKey);
        await mkdir(join(out, key), { recursive: true });
        await writeFile(target, buffer);
      } else {
        await upload(process.env.R2_PUBLIC_BUCKET, objectKey, {
          method: 'PUT',
          body: buffer,
          headers: {
            'Content-Type': `image/${format}`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }
  }
  const location = await locate(exif, { maps, geocode, fetchImpl });
  const data = {
    title: basename(file, extname(file)).replace(/[-_]+/g, ' '),
    alt: 'TODO: describe this photograph',
    remote: { key, width: metadata.width, height: metadata.height, placeholder },
    ...(location ? { location } : {}),
    ...metadataFromExif(exif),
    tags: normalizeTags(tags),
    albums: album ? [album] : [],
    draft: true,
  };
  // Exclusive creation protects entries even during concurrent ingestion.
  await writeFile(entry, stringify(data), { flag: 'wx' });
  return { slug, data };
}
const decodeXml = (value) =>
  value.replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity]
  );
async function inbox(options) {
  const bucket = process.env.R2_INBOX_BUCKET;
  if (!bucket) throw new Error('Missing R2_INBOX_BUCKET');
  const request = r2();
  const directory = '.photos-inbox';
  await mkdir(directory, { recursive: true });
  let token = '';
  const keys = [];
  do {
    const query =
      '?list-type=2' + (token ? '&continuation-token=' + encodeURIComponent(token) : '');
    const xml = await (await request(bucket, '', {}, query)).text();
    keys.push(
      ...[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) =>
        decodeXml(match[1].match(/<Key>([\s\S]*?)<\/Key>/)[1])
      )
    );
    token = decodeXml(
      xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? ''
    );
  } while (token);
  const processed = [];
  for (const key of keys.filter((k) => !k.startsWith('archive/') && imagePattern.test(k))) {
    const target = join(directory, basename(key));
    await writeFile(target, Buffer.from(await (await request(bucket, key)).arrayBuffer()));
    await ingestFile(target, options);
    processed.push(key);
  }
  await writeFile(join(directory, 'processed.json'), JSON.stringify(processed));
  console.log(`Ingested ${processed.length} photos`);
}
async function archiveInbox() {
  const request = r2();
  const bucket = process.env.R2_INBOX_BUCKET;
  if (!bucket) throw new Error('Missing R2_INBOX_BUCKET');
  const processed = JSON.parse(await readFile('.photos-inbox/processed.json', 'utf8'));
  for (const key of processed) {
    const copy = await request(bucket, 'archive/' + key, {
      method: 'PUT',
      headers: {
        'x-amz-copy-source':
          '/' + encodeURIComponent(bucket) + '/' + key.split('/').map(encodeURIComponent).join('/'),
      },
    });
    if (/<Error[>\s]/.test(await copy.text()))
      throw new Error('Inbox archival copy failed; keeping original');
    await request(bucket, key, { method: 'DELETE' });
  }
}
async function collect(paths) {
  const files = [];
  for (const path of paths) {
    if ((await stat(path)).isDirectory())
      files.push(...(await collect((await readdir(path)).map((f) => join(path, f)))));
    else if (imagePattern.test(path)) files.push(path);
  }
  return files;
}
export async function main(args = process.argv.slice(2)) {
  const options = {};
  const paths = [];
  let fromInbox = false;
  let archive = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--from-r2-inbox') fromInbox = true;
    else if (arg === '--archive-inbox') archive = true;
    else if (arg === '--geocode') options.geocode = true;
    else if (arg === '--no-geocode') options.geocode = false;
    else if (['--out', '--album', '--tags', '--maps'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = arg === '--tags' ? value.split(',') : value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else paths.push(arg);
  }
  if (options.dryRun && (fromInbox || archive)) {
    throw new Error('Inbox operations require R2; local --dry-run uploads nothing');
  }
  if (archive) return archiveInbox();
  if (options.album) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.album)) throw new Error('Invalid album slug');
    const exists = await Promise.all(
      ['yml', 'yaml'].map((ext) =>
        access(`src/content/albums/${options.album}.${ext}`).then(
          () => true,
          () => false
        )
      )
    );
    if (!exists.some(Boolean)) throw new Error('Album does not exist: ' + options.album);
  }
  if (fromInbox) return inbox(options);
  if (!paths.length) throw new Error('Pass image files/directories or --from-r2-inbox');
  for (const file of await collect(paths)) console.log((await ingestFile(file, options)).slug);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

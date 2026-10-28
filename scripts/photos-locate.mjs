// Fills photo locations from pasted Google Maps links (including short maps.app.goo.gl links) and
// reverse-geocodes missing place names from coordinates. Resolved links are removed from the entry
// so only the coarse, rounded location is committed.
//
//   pnpm photos:locate                 # every entry in src/content/photos
//   pnpm photos:locate -- pine-ridge   # specific entries
//   pnpm photos:locate -- --no-geocode # links only, no OpenStreetMap lookups
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { isShortMapsUrl, parseGoogleMapsUrl, resolveGoogleMapsUrl } from '../src/lib/geo.ts';
import { locate } from './photos-ingest.mjs';

const isTodo = (value) => typeof value !== 'string' || !value.trim() || /^TODO\b/i.test(value);

/** Returns the updated location (or undefined when nothing changes). */
export async function resolveLocation(location, { geocode = true, fetchImpl = fetch } = {}) {
  if (!location || typeof location !== 'object') return undefined;
  const { maps, ...current } = location;
  let fromLink = {};
  if (maps) {
    fromLink =
      (isShortMapsUrl(maps) ? await resolveGoogleMapsUrl(maps, fetchImpl) : parseGoogleMapsUrl(maps)) ?? {};
    if (fromLink.lat === undefined && fromLink.name === undefined)
      throw new Error('Could not read a place from ' + maps);
  }
  const lat = current.lat ?? fromLink.lat;
  const lng = current.lng ?? fromLink.lng;
  const needsNames = isTodo(current.name) || !current.country;
  const looked =
    geocode && needsNames && lat !== undefined
      ? await locate({ latitude: lat, longitude: lng }, { geocode, fetchImpl })
      : undefined;
  const name = !isTodo(current.name) ? current.name : (fromLink.name ?? looked?.name ?? 'TODO place name');
  const region = current.region ?? looked?.region;
  const country = !isTodo(current.country) ? current.country : looked?.country;
  const next = {
    name,
    ...(region ? { region } : {}),
    ...(country ? { country } : {}),
    ...(lat !== undefined ? { lat, lng } : {}),
  };
  const changed = Boolean(maps) || JSON.stringify(next) !== JSON.stringify(current);
  return changed ? next : undefined;
}

export async function main(args = process.argv.slice(2), { dir = 'src/content/photos', fetchImpl } = {}) {
  const geocode = !args.includes('--no-geocode');
  const only = new Set(args.filter((arg) => !arg.startsWith('--')));
  const files = (await readdir(dir)).filter(
    (file) => /\.ya?ml$/.test(file) && (!only.size || only.has(basename(file, extname(file))))
  );
  let updated = 0;
  for (const file of files) {
    const path = join(dir, file);
    const document = parseDocument(await readFile(path, 'utf8'));
    const location = document.toJS().location;
    const next = await resolveLocation(location, { geocode, fetchImpl });
    if (!next) continue;
    document.set('location', next);
    await writeFile(path, document.toString());
    updated++;
    console.log(`${file}: ${[next.name, next.region, next.country].filter(Boolean).join(', ')}`);
  }
  console.log(`Updated ${updated} of ${files.length} photo entries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

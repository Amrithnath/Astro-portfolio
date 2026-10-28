import { photosBaseUrl, derivativeWidths } from '../data/photos-config.ts';

export const reservedPhotoIds = [
  'tags', 'places', 'albums', 'map', 'feed', 'feed.xml', 'rss', 'rss.xml', 'prints',
];
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(slugify).filter(Boolean))];
}
export function coarseCoordinate(value: number): boolean {
  return Number.isFinite(value) && Number(value.toFixed(2)) === value;
}
export interface Place {
  name: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
}
export function placeName(place: Place): string {
  return [place.name, place.region, place.country].filter(Boolean).join(', ');
}
export function placeSlug(place: Place): string {
  return slugify(placeName(place));
}
export interface PhotoLike {
  id: string;
  data: {
    tags?: string[];
    location?: Place;
    albums: { id: string }[];
    date?: Date;
    draft?: boolean;
  };
}
export function tagIndex<T extends PhotoLike>(photos: T[]) {
  return normalizeTags(photos.flatMap((p) => p.data.tags ?? []))
    .sort()
    .map((slug) => ({
      slug,
      name: slug,
      photos: photos.filter((p) => (p.data.tags ?? []).includes(slug)),
      count: photos.filter((p) => (p.data.tags ?? []).includes(slug)).length,
    }));
}
export function placeIndex<T extends PhotoLike>(photos: T[]) {
  const places = new Map(
    photos
      .filter((p) => p.data.location)
      .map((p) => [placeSlug(p.data.location!), p.data.location!])
  );
  return [...places]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, place]) => {
      const matching = photos.filter((p) => p.data.location && placeSlug(p.data.location) === slug);
      const coordinates = matching.find(
        (photo) => photo.data.location?.lat !== undefined && photo.data.location.lng !== undefined
      )?.data.location;
      return {
        slug,
        name: placeName(place),
        location: coordinates ?? place,
        photos: matching,
        count: matching.length,
      };
    });
}
export function albumPhotos<T extends PhotoLike>(photos: T[], id: string): T[] {
  return photos.filter((p) => p.data.albums.some((album) => album.id === id));
}
export function neighbors<T extends { id: string }>(photos: T[], id: string) {
  const i = photos.findIndex((p) => p.id === id);
  return { prev: i > 0 ? photos[i - 1] : undefined, next: i >= 0 ? photos[i + 1] : undefined };
}
export function assertPhotoIds(photos: { id: string }[]) {
  for (const { id } of photos) {
    if (reservedPhotoIds.includes(id.split('/')[0]))
      throw new Error('Reserved photography id: ' + id);
  }
}
export interface RemoteImage {
  key: string;
  width: number;
  height: number;
  placeholder?: string;
}
export function remoteImage(remote: RemoteImage) {
  const widths = [...new Set(derivativeWidths.map((w) => Math.min(w, remote.width)))];
  const url = (width: number, format: string) =>
    photosBaseUrl + '/' + remote.key + '/' + width + '.' + format;
  return {
    src: url(widths.at(-1)!, 'webp'),
    avif: widths.map((w) => url(w, 'avif') + ' ' + w + 'w').join(', '),
    webp: widths.map((w) => url(w, 'webp') + ' ' + w + 'w').join(', '),
  };
}
export function dateGroups<T extends PhotoLike>(photos: T[]) {
  const groups = new Map<string, T[]>();
  for (const photo of photos) {
    const date = photo.data.date?.toISOString().slice(0, 10) ?? 'Undated';
    const key = date + (photo.data.location ? ' — ' + placeName(photo.data.location) : '');
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

// Equirectangular projection shared by the bundled 720 × 360 land outline and markers.
export function mapPoint(place: Place): { x: number; y: number } | undefined {
  const { lat, lng } = place;
  if (
    lat === undefined ||
    lng === undefined ||
    !coarseCoordinate(lat) ||
    !coarseCoordinate(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) return undefined;
  return { x: (lng + 180) * 2, y: (90 - lat) * 2 };
}

export interface PhotoExif {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  exposureTime?: number;
  iso?: number;
  date?: Date;
  settings?: string;
}
export function shutterSpeed(seconds: number): string {
  const reciprocal = 1 / seconds;
  return seconds < 1 && Math.abs(reciprocal - Math.round(reciprocal)) < 0.0001
    ? `1/${Math.round(reciprocal)}s`
    : `${seconds}s`;
}
// Deliberate allowlist: never pass through GPS, serial numbers or other private EXIF tags.
export function exifRows(data: PhotoExif): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['Camera', data.camera],
    ['Lens', data.lens],
    ['Focal Length', data.focalLength ? `${data.focalLength}mm` : undefined],
    ['Aperture', data.aperture ? `f/${data.aperture}` : undefined],
    ['Shutter Speed', data.exposureTime ? shutterSpeed(data.exposureTime) : undefined],
    ['ISO', data.iso?.toString()],
    ['Taken', data.date?.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC')],
    ['Settings', data.settings],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]?.trim()));
}

export function newestPublishedPhotos<T extends PhotoLike>(photos: T[]): T[] {
  return photos
    .filter((photo) => !photo.data.draft)
    .sort((a, b) =>
      (b.data.date?.valueOf() ?? -Infinity) - (a.data.date?.valueOf() ?? -Infinity)
    );
}

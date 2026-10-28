// Location helpers shared by the content schema and the photo scripts. Everything published is
// coarse: coordinates are rounded to 2 decimals (~1 km) before they are stored or sent anywhere.

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapsLocation extends Partial<Coordinates> {
  name?: string;
}

export const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

const mapsHost = /^(?:www\.|maps\.)?google\.[a-z.]+$/i;
const shortHosts = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

const toUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
};

export function isGoogleMapsUrl(value: string): boolean {
  const url = toUrl(value);
  if (!url) return false;
  if (mapsHost.test(url.hostname)) return url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps');
  return isShortMapsUrl(value);
}

/** Short links (maps.app.goo.gl/…) must be expanded over the network before they can be parsed. */
export function isShortMapsUrl(value: string): boolean {
  const url = toUrl(value);
  if (!url || !shortHosts.includes(url.hostname)) return false;
  return url.hostname !== 'goo.gl' || url.pathname.startsWith('/maps');
}

const coordinatePair = (text: string | null | undefined): Coordinates | undefined => {
  const match = text?.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*\+?(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
};

/**
 * Extracts a place name and rounded coordinates from a full Google Maps URL. Supports place pins
 * (`!3d…!4d…`), map views (`/@lat,lng,zoom`), `?q=`/`query=`/`ll=`/`center=` parameters and
 * `/search/lat,lng`. Returns undefined for short links and non-Maps URLs.
 */
export function parseGoogleMapsUrl(value: string): MapsLocation | undefined {
  const url = toUrl(value);
  if (!url || !isGoogleMapsUrl(value) || isShortMapsUrl(value)) return undefined;
  const path = decodeURIComponent(url.pathname);
  const pin = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const view = path.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const params = ['q', 'query', 'll', 'center', 'destination'].map((key) => url.searchParams.get(key));
  const search = path.match(/\/search\/([^/]+)/)?.[1]?.replace(/\+/g, ' ');
  const coordinates =
    (pin && { lat: Number(pin[1]), lng: Number(pin[2]) }) ||
    params.map(coordinatePair).find(Boolean) ||
    coordinatePair(search) ||
    (view && { lat: Number(view[1]), lng: Number(view[2]) }) ||
    undefined;
  const placeSegment = path.match(/\/place\/([^/]+)/)?.[1];
  const query = params.find((param) => param && !coordinatePair(param));
  const rawName = (placeSegment && !coordinatePair(placeSegment.replace(/\+/g, ' ')) ? placeSegment : query)
    ?.replace(/\+/g, ' ')
    .trim();
  const name = rawName?.split(',')[0]?.trim() || undefined;
  if (!coordinates && !name) return undefined;
  return {
    ...(name ? { name } : {}),
    ...(coordinates ? { lat: roundCoordinate(coordinates.lat), lng: roundCoordinate(coordinates.lng) } : {}),
  };
}

/** Follows a short Maps link (only to Google hosts) and parses the expanded URL. */
export async function resolveGoogleMapsUrl(
  value: string,
  fetchImpl: typeof fetch = fetch
): Promise<MapsLocation | undefined> {
  let current = value;
  for (let hop = 0; hop < 5 && isShortMapsUrl(current); hop++) {
    const response = await fetchImpl(current, { method: 'HEAD', redirect: 'manual' });
    const next = response.headers.get('location');
    if (!next) break;
    current = new URL(next, current).href;
  }
  if (!isGoogleMapsUrl(current) || isShortMapsUrl(current)) return undefined;
  return parseGoogleMapsUrl(current);
}

export interface ReversePlace {
  name?: string;
  region?: string;
  country?: string;
}

export const geocoderAttribution = 'Place names © OpenStreetMap contributors (ODbL)';

/**
 * City-level reverse geocoding through OpenStreetMap Nominatim. Only rounded coordinates leave the
 * machine. Respect the usage policy: identify the app and make at most one request per second.
 */
export async function reverseGeocode(
  { lat, lng }: Coordinates,
  fetchImpl: typeof fetch = fetch
): Promise<ReversePlace | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(roundCoordinate(lat)),
    lon: String(roundCoordinate(lng)),
    zoom: '10',
    'accept-language': 'en',
  }).toString();
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'amrithnath.dev photo tools (+https://github.com/Amrithnath/Astro-portfolio)' },
  });
  if (!response.ok) return undefined;
  const { address = {} } = (await response.json()) as { address?: Record<string, string> };
  const name =
    address.city || address.town || address.village || address.municipality || address.hamlet || address.county || address.state_district;
  const region = address.state || address.region || address.province;
  return {
    ...(name ? { name } : {}),
    ...(region && region !== name ? { region } : {}),
    ...(address.country ? { country: address.country } : {}),
  };
}

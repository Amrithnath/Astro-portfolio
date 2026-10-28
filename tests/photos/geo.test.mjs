import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { parse } from 'yaml';
import {
  isGoogleMapsUrl,
  isShortMapsUrl,
  parseGoogleMapsUrl,
  resolveGoogleMapsUrl,
  reverseGeocode,
} from '../../src/lib/geo.ts';
import { main as locateMain, resolveLocation } from '../../scripts/photos-locate.mjs';
import { locate } from '../../scripts/photos-ingest.mjs';

const nominatim = (address) => async (url) => {
  assert.match(String(url), /^https:\/\/nominatim\.openstreetmap\.org\/reverse\?/);
  return Response.json({ address });
};

test('parses Google Maps place pins, map views and query links into rounded coordinates', () => {
  assert.deepEqual(
    parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Munnar,+Kerala/@10.0889,77.0595,13z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d10.0889333!4d77.0595248'
    ),
    { name: 'Munnar', lat: 10.09, lng: 77.06 }
  );
  assert.deepEqual(parseGoogleMapsUrl('https://www.google.com/maps/@-33.8567844,151.2152967,15z'), {
    lat: -33.86,
    lng: 151.22,
  });
  assert.deepEqual(parseGoogleMapsUrl('https://maps.google.com/?q=51.5007,-0.1246'), {
    lat: 51.5,
    lng: -0.12,
  });
  assert.deepEqual(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Ooty'), {
    name: 'Ooty',
  });
  assert.deepEqual(parseGoogleMapsUrl('https://www.google.co.in/maps/search/12.34,+76.5'), {
    lat: 12.34,
    lng: 76.5,
  });
});

test('rejects non-Maps links and recognises short links', () => {
  for (const url of ['https://example.com/maps/@1,2,3z', 'https://www.google.com/search?q=1,2', 'not a url'])
    assert.equal(isGoogleMapsUrl(url), false, url);
  assert.equal(parseGoogleMapsUrl('https://example.com/maps/@1,2,3z'), undefined);
  assert.equal(isShortMapsUrl('https://maps.app.goo.gl/AbC123'), true);
  assert.equal(isShortMapsUrl('https://goo.gl/maps/AbC123'), true);
  assert.equal(isShortMapsUrl('https://goo.gl/other'), false);
  assert.equal(parseGoogleMapsUrl('https://maps.app.goo.gl/AbC123'), undefined);
});

test('short links are expanded, but only through Google hosts', async () => {
  const redirect = (location) => async () => new Response(null, { status: 302, headers: { location } });
  assert.deepEqual(
    await resolveGoogleMapsUrl(
      'https://maps.app.goo.gl/AbC123',
      redirect('https://www.google.com/maps/place/Kodaikanal/@10.2381,77.4892,14z')
    ),
    { name: 'Kodaikanal', lat: 10.24, lng: 77.49 }
  );
  assert.equal(
    await resolveGoogleMapsUrl('https://maps.app.goo.gl/AbC123', redirect('https://evil.example/maps/@1,2,3z')),
    undefined
  );
});

test('reverse geocoding sends only rounded coordinates and returns city-level names', async () => {
  let requested;
  const place = await reverseGeocode({ lat: 10.088933, lng: 77.059525 }, async (url) => {
    requested = new URL(url);
    return Response.json({ address: { town: 'Munnar', state: 'Kerala', country: 'India' } });
  });
  assert.equal(requested.searchParams.get('lat'), '10.09');
  assert.equal(requested.searchParams.get('lon'), '77.06');
  assert.equal(requested.searchParams.get('zoom'), '10');
  assert.deepEqual(place, { name: 'Munnar', region: 'Kerala', country: 'India' });
});

test('ingest prefers a Maps link over EXIF and geocodes names when enabled', async () => {
  const exif = { latitude: 1.234, longitude: 2.345 };
  assert.deepEqual(await locate(exif), { name: 'TODO place name', lat: 1.23, lng: 2.35 });
  assert.deepEqual(
    await locate(exif, { geocode: true, fetchImpl: nominatim({ city: 'Bengaluru', state: 'Karnataka', country: 'India' }) }),
    { name: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 1.23, lng: 2.35 }
  );
  assert.deepEqual(
    await locate(exif, { maps: 'https://www.google.com/maps/place/Hampi/@15.335,76.46,14z' }),
    { name: 'Hampi', lat: 15.34, lng: 76.46 }
  );
  assert.equal(await locate({}), undefined);
  await assert.rejects(locate({}, { maps: 'https://example.com/' }), /Google Maps link/);
});

test('photos:locate resolves pasted links, keeps manual names and strips the link', async () => {
  assert.deepEqual(
    await resolveLocation(
      { name: 'Home ridge', maps: 'https://www.google.com/maps/@12.971599,77.594566,12z' },
      { fetchImpl: nominatim({ city: 'Bengaluru', state: 'Karnataka', country: 'India' }) }
    ),
    { name: 'Home ridge', region: 'Karnataka', country: 'India', lat: 12.97, lng: 77.59 }
  );
  assert.equal(await resolveLocation({ name: 'Ooty', country: 'India' }), undefined);

  const dir = '.photos-tests-' + randomUUID();
  await mkdir(dir);
  try {
    await writeFile(
      join(dir, 'a.yml'),
      '# keep me\ntitle: A\nlocation:\n  maps: https://www.google.com/maps/place/Munnar/@10.0889,77.0595,13z\n'
    );
    await writeFile(join(dir, 'b.yml'), 'title: B\n');
    await locateMain(['--no-geocode'], { dir });
    const text = await readFile(join(dir, 'a.yml'), 'utf8');
    assert.match(text, /# keep me/);
    assert.doesNotMatch(text, /maps:/);
    assert.deepEqual(parse(text).location, { name: 'Munnar', lat: 10.09, lng: 77.06 });
    assert.equal(await readFile(join(dir, 'b.yml'), 'utf8'), 'title: B\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

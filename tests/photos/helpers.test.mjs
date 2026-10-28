import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumPhotos,
  assertPhotoIds,
  coarseCoordinate,
  dateGroups,
  neighbors,
  mapPoint,
  exifRows,
  newestPublishedPhotos,
  reservedPhotoIds,
  normalizeTags,
  placeIndex,
  placeSlug,
  remoteImage,
  tagIndex,
} from '../../src/features/photos/photos.ts';

const photos = [
  {
    id: 'one',
    data: {
      tags: ['landscape', 'sunset'],
      albums: [{ id: 'trip' }],
      location: { name: 'Test place', region: 'Test region', country: 'Test country' },
      date: new Date('2026-01-01'),
    },
  },
  {
    id: 'two',
    data: {
      tags: ['landscape'],
      albums: [],
      location: { name: 'Test place', region: 'Test region', country: 'Test country' },
    },
  },
];
test('normalizes and deduplicates tags and accepts only coarse coordinates', () => {
  assert.deepEqual(normalizeTags(['Golden Hour', 'golden-hour', ' Héllo! ', '']), [
    'golden-hour',
    'hello',
  ]);
  assert.ok(coarseCoordinate(12.34));
  assert.ok(coarseCoordinate(-73.12));
  assert.ok(!coarseCoordinate(12.345));
});
test('indexes tags and structured places with counts', () => {
  assert.deepEqual(
    tagIndex(photos).map((t) => [t.slug, t.count]),
    [
      ['landscape', 2],
      ['sunset', 1],
    ]
  );
  assert.equal(placeIndex(photos)[0].count, 2);
  assert.equal(placeSlug(photos[0].data.location), 'test-place-test-region-test-country');
  assert.equal(placeIndex([]).length, 0);
});
test('looks up albums, chronological date/place groups and adjacent photos', () => {
  assert.deepEqual(albumPhotos(photos, 'trip'), [photos[0]]);
  assert.equal(dateGroups(photos)[0][0], '2026-01-01 — Test place, Test region, Test country');
  assert.equal(neighbors(photos, 'one').prev, undefined);
  assert.equal(neighbors(photos, 'one').next.id, 'two');
  assert.equal(neighbors(photos, 'missing').next, undefined);
  assert.throws(() => assertPhotoIds([{ id: 'tags' }]), /Reserved/);
  assert.throws(() => assertPhotoIds([{ id: 'places/anything' }]), /Reserved/);
});
test('remote srcsets match capped derivative widths and immutable key layout', () => {
  const image = remoteImage({ key: 'test/hash', width: 900, height: 600 });
  assert.equal(image.src, 'https://photos.amrithnath.dev/test/hash/900.webp');
  assert.match(image.avif, /480.avif 480w, .*800.avif 800w, .*900.avif 900w$/);
  assert.equal(
    remoteImage({ key: 'tiny', width: 200, height: 100 }).webp,
    'https://photos.amrithnath.dev/tiny/200.webp 200w'
  );
});

test('maps each place once, preserves available coordinates and projects the equator and bounds', () => {
  const located = { ...photos[0], data: { ...photos[0].data, location: { ...photos[0].data.location, lat: 0, lng: 0 } } };
  const entries = placeIndex([located, photos[1]]);
  assert.equal(entries.length, 1);
  assert.deepEqual(mapPoint(entries[0].location), { x: 360, y: 180 });
  assert.deepEqual(mapPoint({ name: 'Corner', lat: 90, lng: -180 }), { x: 0, y: 0 });
  assert.deepEqual(mapPoint({ name: 'Corner', lat: -90, lng: 180 }), { x: 720, y: 360 });
  for (const coordinates of [{}, { lat: 0 }, { lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: 1.234, lng: 0 }]) {
    assert.equal(mapPoint({ name: 'Not mapped', ...coordinates }), undefined);
  }
});

test('reserved root routes cannot become photo IDs or nested photo paths', () => {
  for (const id of reservedPhotoIds) {
    assert.throws(() => assertPhotoIds([{ id }]), /Reserved photography id/);
    assert.throws(() => assertPhotoIds([{ id: id + '/nested' }]), /Reserved photography id/);
  }
  assert.doesNotThrow(() => assertPhotoIds([{ id: 'maple-leaves' }]));
});

test('EXIF panel allowlists available fields, formats units, and never includes GPS or serials', () => {
  assert.deepEqual(exifRows({}), []);
  assert.deepEqual(exifRows({ camera: ' ', GPSLatitude: 12.34, GPSLongitude: 56.78, SerialNumber: 'private' }), []);
  assert.deepEqual(exifRows({
    camera: 'Test camera', lens: 'Test lens', focalLength: 35, aperture: 1.8,
    exposureTime: 1 / 250, iso: 100, date: new Date('2026-01-02T12:34:56Z'),
    latitude: 12.34, longitude: 56.78,
  }), [
    ['Camera', 'Test camera'], ['Lens', 'Test lens'], ['Focal Length', '35mm'],
    ['Aperture', 'f/1.8'], ['Shutter Speed', '1/250s'], ['ISO', '100'],
    ['Taken', '2026-01-02 12:34:56 UTC'],
  ]);
  assert.deepEqual(exifRows({ exposureTime: 0.3 }), [['Shutter Speed', '0.3s']]);
  assert.deepEqual(exifRows({ exposureTime: 2, settings: 'Legacy settings' }), [
    ['Shutter Speed', '2s'], ['Settings', 'Legacy settings'],
  ]);
});

test('feed excludes drafts, ignores featured order, sorts newest first and puts undated last', () => {
  const entries = [
    { id: 'old-featured', data: { albums: [], date: new Date('1965-01-01'), featured: true } },
    { id: 'undated', data: { albums: [] } },
    { id: 'new', data: { albums: [], date: new Date('2026-01-01') } },
    { id: 'draft', data: { albums: [], date: new Date('2027-01-01'), draft: true } },
  ];
  assert.deepEqual(newestPublishedPhotos(entries).map(({ id }) => id), ['new', 'old-featured', 'undated']);
  assert.equal(entries[0].id, 'old-featured');
  assert.deepEqual(newestPublishedPhotos([]), []);
});

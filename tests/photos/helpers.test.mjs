import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumPhotos,
  assertPhotoIds,
  coarseCoordinate,
  dateGroups,
  neighbors,
  normalizeTags,
  placeIndex,
  placeSlug,
  remoteImage,
  tagIndex,
} from '../../src/lib/photos.ts';

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

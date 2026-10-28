import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { parse } from 'yaml';
import { ingestFile, metadataFromExif, settingsFromExif } from '../../scripts/photos-ingest.mjs';

test('dry-run ingests camera and coarse GPS metadata, strips derivatives and never overwrites', async () => {
  const root = '.photos-tests-' + randomUUID();
  const contentDir = join(root, 'content');
  const out = join(root, 'derivatives');
  await mkdir(root);
  try {
    const file = join(root, 'Test Photo.jpg');
    await sharp({ create: { width: 900, height: 600, channels: 3, background: '#456789' } })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Test Camera', Model: 'Model One' },
        IFD2: {
          DateTimeOriginal: '2026:01:02 12:34:56',
          LensModel: 'Test lens',
          FocalLength: '35/1',
          FNumber: '18/10',
          ExposureTime: '1/250',
          ISOSpeedRatings: '100',
        },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '12/1 20/1 4444/100',
          GPSLongitudeRef: 'W',
          GPSLongitude: '73/1 7/1 2444/100',
        },
      })
      .toFile(file);
    // Run the same CLI locally from a fixture cwd: metadata and derivatives stay under the project.
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), 'scripts/photos-ingest.mjs'),
        file.replace(root + '/', ''),
        '--dry-run',
        '--out',
        'derivatives',
        '--tags',
        'Golden Hour,golden-hour',
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    const entry = join(root, 'src/content/photos/test-photo.yml');
    const before = await readFile(entry, 'utf8');
    const data = parse(before);
    assert.equal(data.location.lat, 12.35);
    assert.equal(data.location.lng, -73.12);
    assert.equal(data.location.name, 'TODO place name');
    assert.equal(data.location.country, undefined);
    assert.equal(data.camera, 'Test Camera Model One');
    assert.equal(data.lens, 'Test lens');
    assert.equal(data.focalLength, 35);
    assert.equal(data.aperture, 1.8);
    assert.equal(data.exposureTime, 1 / 250);
    assert.equal(data.iso, 100);
    assert.match(data.date, /^2026-01-02/);
    assert.equal(data.settings, '35mm · f/1.8 · 1/250s · ISO 100');
    assert.deepEqual(data.tags, ['golden-hour']);
    assert.equal(data.draft, true);
    const files = await readdir(join(out, data.remote.key));
    assert.deepEqual(files.sort(), [
      '480.avif',
      '480.webp',
      '800.avif',
      '800.webp',
      '900.avif',
      '900.webp',
    ]);
    for (const derivative of files) {
      const metadata = await sharp(join(out, data.remote.key, derivative)).metadata();
      assert.equal(metadata.exif, undefined);
      assert.ok(metadata.width <= 900);
      assert.equal(metadata.width, parseInt(derivative));
    }
    await assert.rejects(
      ingestFile(file, { dryRun: true, out, contentDir: join(root, 'src/content/photos') }),
      /overwrite/
    );
    assert.equal(await readFile(entry, 'utf8'), before);
    const albumEntry = await ingestFile(file, {
      dryRun: true,
      out,
      contentDir,
      album: 'landscapes',
    });
    assert.deepEqual(albumEntry.data.albums, ['landscapes']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('formats slower exposures and rejects network-free invocation without inputs', () => {
  assert.equal(settingsFromExif({ ExposureTime: 2, ISO: 200 }), '2s · ISO 200');
  const result = spawnSync(process.execPath, ['scripts/photos-ingest.mjs', '--dry-run'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pass image/);
});

test('orients photos before sizing and does not upscale small originals', async () => {
  const root = '.photos-tests-' + randomUUID();
  await mkdir(root);
  try {
    const file = join(root, 'rotated.jpg');
    await sharp({ create: { width: 100, height: 200, channels: 3, background: '#456789' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(file);
    assert.equal((await sharp(file).metadata()).orientation, 6);
    const { data } = await ingestFile(file, {
      dryRun: true,
      out: join(root, 'out'),
      contentDir: join(root, 'content'),
    });
    assert.equal(data.remote.width, 200);
    assert.equal(data.remote.height, 100);
    const files = await readdir(join(root, 'out', data.remote.key));
    assert.deepEqual(files.sort(), ['200.avif', '200.webp']);
    const metadata = await sharp(join(root, 'out', data.remote.key, '200.webp')).metadata();
    assert.equal(metadata.width, 200);
    assert.equal(metadata.height, 100);
    assert.equal(metadata.orientation, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ingest EXIF allowlist omits missing, invalid and private tags without inventing fields', () => {
  assert.deepEqual(metadataFromExif({}), {});
  assert.deepEqual(metadataFromExif({
    GPSLatitude: 12.3456, GPSLongitude: 56.789, latitude: 12.3456, longitude: 56.789,
    BodySerialNumber: 'private', LensSerialNumber: 'private', DateTimeOriginal: new Date(NaN),
    FocalLength: -1, FNumber: 0, ExposureTime: Infinity, ISO: 1.5,
  }), {});
  assert.deepEqual(metadataFromExif({ ExposureTime: 0.3, ISO: 200 }), {
    exposureTime: 0.3, iso: 200, settings: '0.3s · ISO 200',
  });
});

test('ingest rejects reserved route names before creating an entry', async () => {
  for (const filename of ['map.jpg', 'feed.jpg', 'rss.jpg', 'prints.jpg']) {
    await assert.rejects(ingestFile(filename, { dryRun: true }), /Reserved or invalid photo slug/);
  }
});

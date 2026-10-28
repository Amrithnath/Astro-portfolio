// Gallery originals in src/assets/photos are public in the repository, so they must not carry
// GPS coordinates. Every image also needs a src/content/photos entry (and vice versa).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';

const assetsDir = 'src/assets/photos';
const entriesDir = 'src/content/photos';
const images = readdirSync(assetsDir).filter((file) =>
  /\.(avif|jpe?g|png|tiff?|webp)$/i.test(file)
);
const entries = readdirSync(entriesDir).filter((file) => /\.ya?ml$/.test(file));

// Minimal TIFF walk: IFD0 → GPS IFD (tag 0x8825) → latitude (0x0002) / longitude (0x0004).
function hasGpsCoordinates(exif) {
  const tiff = exif.subarray(exif.indexOf('Exif\0\0') === 0 ? 6 : 0);
  if (tiff.length < 8) return false;
  const le = tiff.toString('latin1', 0, 2) === 'II';
  const u16 = (offset) => (le ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset));
  const u32 = (offset) => (le ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset));
  const tags = (offset) => {
    if (offset + 2 > tiff.length) return new Map();
    const result = new Map();
    for (let i = 0, count = u16(offset); i < count; i++) {
      const entry = offset + 2 + i * 12;
      if (entry + 12 > tiff.length) break;
      result.set(u16(entry), u32(entry + 8));
    }
    return result;
  };
  const gpsOffset = tags(u32(4)).get(0x8825);
  if (!gpsOffset) return false;
  const gps = tags(gpsOffset);
  return gps.has(0x0002) || gps.has(0x0004);
}

for (const file of images) {
  const { exif } = await sharp(join(assetsDir, file)).metadata();
  assert.ok(
    !exif || !hasGpsCoordinates(exif),
    `${file}: remove GPS location data before committing`
  );
}

const referenced = new Set(
  entries.flatMap((file) => {
    const data = parse(readFileSync(join(entriesDir, file), 'utf8'));
    assert.ok(
      Boolean(data.image) !== Boolean(data.remote),
      file + ': provide exactly one local image or remote source'
    );
    if (data.remote) return [];
    return data.image.split('/').pop();
  })
);
for (const file of referenced) assert.ok(images.includes(file), `${file}: local image not found`);
for (const file of images) assert.ok(referenced.has(file), `${file}: no src/content/photos entry`);

console.log(`Photo checks passed: ${images.length} images, no GPS metadata, all catalogued.`);

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import sharp from 'sharp';
import { parse } from 'yaml';

// The signing/upload pipeline runs against an in-process fetch stub, never Cloudflare.
test('inbox uploads only derivatives publicly and archives privately after PR persistence', async () => {
  const root = '.photos-tests-' + randomUUID();
  await mkdir(root);
  try {
    await sharp({ create: { width: 100, height: 80, channels: 3, background: '#456789' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'Private original' } })
      .toFile(join(root, 'original.jpg'));
    await writeFile(
      join(root, 'mock-r2.mjs'),
      `
import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  await appendFile('requests.jsonl', JSON.stringify({ method: request.method, path, copy: request.headers.get('x-amz-copy-source') }) + '\\n');
  if (request.method === 'GET' && url.searchParams.has('list-type')) {
    return new Response('<ListBucketResult><Contents><Key>incoming/Test Original.jpg</Key></Contents><Contents><Key>archive/old.jpg</Key></Contents></ListBucketResult>');
  }
  if (request.method === 'GET' && path === '/private-inbox/incoming/Test Original.jpg') return new Response(await readFile('original.jpg'));
  if (request.method === 'PUT' && path.startsWith('/public-derivatives/')) {
    assert.match(path, /\\/100\\.(avif|webp)$/);
    assert.match(request.headers.get('content-type'), /^image\\/(avif|webp)$/);
    assert.equal(request.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    const metadata = await sharp(Buffer.from(await request.arrayBuffer())).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width, 100);
    return new Response('');
  }
  if (request.method === 'PUT' && path.startsWith('/private-inbox/archive/')) {
    return new Response(process.env.FAIL_COPY ? '<Error><Code>InternalError</Code></Error>' : '<CopyObjectResult/>');
  }
  if (request.method === 'DELETE' && path === '/private-inbox/incoming/Test Original.jpg') return new Response('');
  throw new Error('Unexpected R2 request: ' + request.method + ' ' + path);
};
`
    );
    const env = {
      ...process.env,
      R2_ACCOUNT_ID: 'test-account',
      R2_ACCESS_KEY_ID: 'test-key',
      R2_SECRET_ACCESS_KEY: 'test-secret',
      R2_INBOX_BUCKET: 'private-inbox',
      R2_PUBLIC_BUCKET: 'public-derivatives',
    };
    const invoke = (args, extraEnv = {}) =>
      spawnSync(
        process.execPath,
        ['--import', resolve(root, 'mock-r2.mjs'), resolve('scripts/photos-ingest.mjs'), ...args],
        { cwd: root, env: { ...env, ...extraEnv }, encoding: 'utf8' }
      );
    const ingested = invoke(['--from-r2-inbox', '--tags', 'Test Tag']);
    assert.equal(ingested.status, 0, ingested.stderr);
    const entry = parse(await readFile(join(root, 'src/content/photos/test-original.yml'), 'utf8'));
    assert.deepEqual(entry.tags, ['test-tag']);
    assert.equal(entry.draft, true);
    const requests = async () =>
      (await readFile(join(root, 'requests.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
    const uploads = (await requests()).filter((r) => r.method === 'PUT');
    assert.equal(uploads.length, 2);
    assert.ok(uploads.every((r) => r.path.startsWith('/public-derivatives/test-original/')));
    assert.ok(!(await requests()).some((r) => r.method === 'DELETE'));
    const failedArchive = invoke(['--archive-inbox'], { FAIL_COPY: '1' });
    assert.equal(failedArchive.status, 1);
    assert.match(failedArchive.stderr, /keeping original/);
    assert.ok(!(await requests()).some((r) => r.method === 'DELETE'));
    const archived = invoke(['--archive-inbox']);
    assert.equal(archived.status, 0, archived.stderr);
    const last = (await requests()).slice(-2);
    assert.equal(last[0].path, '/private-inbox/archive/incoming/Test Original.jpg');
    assert.equal(last[0].copy, '/private-inbox/incoming/Test%20Original.jpg');
    assert.equal(last[1].method, 'DELETE');
    const unsafe = invoke(['--from-r2-inbox'], { R2_PUBLIC_BUCKET: 'private-inbox' });
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /must be different/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

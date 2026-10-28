// Anonymous per-article view counter for amrithnath.dev, deployed as a Cloudflare Worker with D1.
// Privacy: no cookies, and nothing about the visitor (IP, user agent, referrer) is read or stored;
// the only data is one counter per article path. Requests that send `Sec-GPC: 1` or `DNT: 1` get
// the current count without incrementing it. Repeat views are de-duplicated by the browser, which
// only POSTs once per path. Everything fails closed: unknown origins, malformed input and unknown
// pages are rejected before touching the database.

const MAX_PATH_LENGTH = 160;
const MAX_BODY_BYTES = 512;
const PATH_PATTERN = /^\/(?:blog|project)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/$/;
const ORIGIN_PATTERN = /^(?:https:\/\/[a-z0-9.-]+|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?)$/;

export const isValidPath = (path) =>
  typeof path === 'string' && path.length <= MAX_PATH_LENGTH && PATH_PATTERN.test(path);

export const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter((origin) => ORIGIN_PATTERN.test(origin));

const siteOrigin = (env) => {
  const site = (env.SITE_URL ?? '').trim().toLowerCase().replace(/\/$/, '');
  return /^https:\/\/[a-z0-9.-]+$/.test(site) ? site : null;
};

export const optedOut = (request) =>
  request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1';

const baseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...baseHeaders,
      ...(origin ? corsHeaders(origin) : {}),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

const readCount = async (env, path) =>
  Number((await env.DB.prepare('SELECT count FROM views WHERE path = ?1').bind(path).first('count')) ?? 0);

// Only real, published pages get a row, so arbitrary valid-looking paths cannot fill the table.
const pageExists = async (env, path) => {
  const site = siteOrigin(env);
  if (!site) return false;
  try {
    const response = await fetch(`${site}${path}`, {
      method: 'HEAD',
      redirect: 'manual',
      cf: { cacheTtl: 300 },
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

const increment = async (env, path) => {
  const updated = await env.DB.prepare(
    'UPDATE views SET count = count + 1 WHERE path = ?1 RETURNING count',
  )
    .bind(path)
    .first('count');
  if (updated !== null && updated !== undefined) return Number(updated);
  if (!(await pageExists(env, path))) return null;
  return Number(
    await env.DB.prepare(
      'INSERT INTO views (path, count) VALUES (?1, 1) ON CONFLICT(path) DO UPDATE SET count = count + 1 RETURNING count',
    )
      .bind(path)
      .first('count'),
  );
};

const readBody = async (request) => {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) return null;
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/views') return json({ error: 'not_found' }, 404);

    const origin = (request.headers.get('Origin') ?? '').toLowerCase();
    if (!origin || !allowedOrigins(env).includes(origin)) return json({ error: 'forbidden' }, 403);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...baseHeaders, ...corsHeaders(origin) } });
    }
    if (!env.DB) return json({ error: 'unavailable' }, 503, origin);

    try {
      if (request.method === 'GET') {
        const path = url.searchParams.get('path');
        if (!isValidPath(path)) return json({ error: 'invalid_path' }, 400, origin);
        return json({ path, count: await readCount(env, path) }, 200, origin);
      }

      if (request.method === 'POST') {
        const body = await readBody(request);
        if (!body) return json({ error: 'invalid_body' }, 400, origin);
        const { path } = body;
        if (!isValidPath(path)) return json({ error: 'invalid_path' }, 400, origin);
        if (optedOut(request)) {
          return json({ path, count: await readCount(env, path), counted: false }, 200, origin);
        }
        const count = await increment(env, path);
        if (count === null) return json({ error: 'unknown_page' }, 404, origin);
        return json({ path, count, counted: true }, 200, origin);
      }
    } catch {
      return json({ error: 'unavailable' }, 503, origin);
    }

    return json({ error: 'method_not_allowed' }, 405, origin);
  },
};

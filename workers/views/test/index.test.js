import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import worker, { isValidPath } from '../src/index.js';

const API = 'https://views.amrithnath.dev/views';
const ORIGIN = 'https://amrithnath.dev';
const PATH = '/blog/bluetooth-dystopia/';

// Minimal in-memory D1 stand-in that understands the Worker's three statements.
const createDb = (rows = {}) => {
  const data = new Map(Object.entries(rows));
  const queries = [];
  const db = {
    data,
    queries,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first(column) {
              queries.push({ sql, args });
              const [path] = args;
              let count;
              if (sql.startsWith('SELECT')) count = data.get(path);
              else if (sql.startsWith('UPDATE')) {
                if (data.has(path)) data.set(path, data.get(path) + 1);
                count = data.get(path);
              } else if (sql.startsWith('INSERT')) {
                data.set(path, (data.get(path) ?? 0) + 1);
                count = data.get(path);
              } else throw new Error(`Unexpected SQL: ${sql}`);
              return count === undefined ? null : column ? count : { count };
            },
          };
        },
      };
    },
  };
  return db;
};

const makeEnv = (db = createDb()) => ({
  DB: db,
  ALLOWED_ORIGINS: 'https://amrithnath.dev, https://portfolio-e0a.pages.dev,http://localhost:4321',
  SITE_URL: 'https://amrithnath.dev',
});

const request = (env, { method = 'GET', query = '', body, headers = {} } = {}) =>
  worker.fetch(
    new Request(`${API}${query}`, {
      method,
      headers: { Origin: ORIGIN, ...headers },
      body,
    }),
    env,
  );

const post = (env, body, headers = {}) =>
  request(env, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });

afterEach(() => mock.restoreAll());

describe('path validation', () => {
  it('accepts article paths only', () => {
    for (const path of [PATH, '/project/webDev/weather-app/', '/blog/a_b-1/']) {
      assert.equal(isValidPath(path), true, path);
    }
    for (const path of [
      '/blog/',
      '/blog/x',
      '/about/',
      '/blog//x/',
      '/blog/../x/',
      '/blog/x.md/',
      '/blog/x/?a=1',
      'https://evil.example/blog/x/',
      `/blog/${'a'.repeat(160)}/`,
      null,
      42,
    ]) {
      assert.equal(isValidPath(path), false, String(path));
    }
  });
});

describe('GET /views', () => {
  it('returns the stored count', async () => {
    const env = makeEnv(createDb({ [PATH]: 41 }));
    const response = await request(env, { query: `?path=${encodeURIComponent(PATH)}` });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: PATH, count: 41 });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  });

  it('returns zero for unseen pages without writing', async () => {
    const env = makeEnv();
    const response = await request(env, { query: `?path=${encodeURIComponent(PATH)}` });
    assert.deepEqual(await response.json(), { path: PATH, count: 0 });
    assert.equal(env.DB.data.size, 0);
  });

  it('rejects invalid paths before querying', async () => {
    const env = makeEnv();
    const response = await request(env, { query: '?path=/about/' });
    assert.equal(response.status, 400);
    assert.equal(env.DB.queries.length, 0);
  });
});

describe('origins', () => {
  it('rejects unknown and missing origins without CORS headers', async () => {
    const env = makeEnv();
    for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }]) {
      const response = await request(env, { query: `?path=${PATH}`, headers });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    assert.equal(env.DB.queries.length, 0);
  });

  it('fails closed without ALLOWED_ORIGINS', async () => {
    const response = await request({ ...makeEnv(), ALLOWED_ORIGINS: '' }, { query: `?path=${PATH}` });
    assert.equal(response.status, 403);
  });

  it('ignores wildcard and malformed allowlist entries', async () => {
    const env = { ...makeEnv(), ALLOWED_ORIGINS: '*,https://*.example,http://amrithnath.dev' };
    const response = await request(env, {
      query: `?path=${PATH}`,
      headers: { Origin: 'http://amrithnath.dev' },
    });
    assert.equal(response.status, 403);
  });

  it('answers preflight requests for allowed origins', async () => {
    const response = await request(makeEnv(), {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4321' },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4321');
    assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
  });
});

describe('POST /views', () => {
  it('increments an existing counter', async () => {
    const env = makeEnv(createDb({ [PATH]: 9 }));
    const fetchMock = mock.method(globalThis, 'fetch');
    const response = await post(env, { path: PATH });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: PATH, count: 10, counted: true });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('creates a counter only after confirming the page exists on the site', async () => {
    const env = makeEnv();
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200 }));
    const response = await post(env, { path: PATH });
    assert.deepEqual(await response.json(), { path: PATH, count: 1, counted: true });
    assert.equal(fetchMock.mock.calls[0].arguments[0], `https://amrithnath.dev${PATH}`);
    assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'HEAD');
    assert.equal(fetchMock.mock.calls[0].arguments[1].redirect, 'manual');
  });

  it('refuses to create counters for pages that do not exist', async () => {
    for (const status of [404, 301]) {
      const env = makeEnv();
      mock.method(globalThis, 'fetch', async () => new Response(null, { status }));
      const response = await post(env, { path: '/blog/not-a-post/' });
      assert.equal(response.status, 404);
      assert.equal(env.DB.data.size, 0);
      mock.restoreAll();
    }
  });

  it('refuses to create counters without a valid SITE_URL', async () => {
    const env = { ...makeEnv(), SITE_URL: '' };
    const fetchMock = mock.method(globalThis, 'fetch');
    const response = await post(env, { path: PATH });
    assert.equal(response.status, 404);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  for (const header of ['Sec-GPC', 'DNT']) {
    it(`returns the count without incrementing when ${header}: 1 is sent`, async () => {
      const env = makeEnv(createDb({ [PATH]: 5 }));
      const response = await post(env, { path: PATH }, { [header]: '1' });
      assert.deepEqual(await response.json(), { path: PATH, count: 5, counted: false });
      assert.equal(env.DB.data.get(PATH), 5);
    });
  }

  it('rejects malformed bodies before querying', async () => {
    const env = makeEnv();
    const cases = [
      () => post(env, 'not json'),
      () => post(env, '[]'),
      () => post(env, { path: '/about/' }),
      () => post(env, { path: `/blog/${'a'.repeat(600)}/` }),
      () => request(env, { method: 'POST', body: JSON.stringify({ path: PATH }), headers: { 'Content-Type': 'text/plain' } }),
    ];
    for (const send of cases) assert.equal((await send()).status, 400);
    assert.equal(env.DB.queries.length, 0);
  });

  it('never reads visitor identifiers', async () => {
    const env = makeEnv(createDb({ [PATH]: 1 }));
    const seen = [];
    const req = new Request(API, {
      method: 'POST',
      body: JSON.stringify({ path: PATH }),
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    });
    const originalGet = req.headers.get.bind(req.headers);
    req.headers.get = (name) => {
      seen.push(name.toLowerCase());
      return originalGet(name);
    };
    await worker.fetch(req, env);
    for (const name of ['cf-connecting-ip', 'x-forwarded-for', 'user-agent', 'cookie', 'referer']) {
      assert.equal(seen.includes(name), false, name);
    }
    assert.deepEqual(env.DB.queries.map(({ args }) => args), [[PATH]]);
  });
});

describe('errors', () => {
  it('returns 503 when the database is missing or failing', async () => {
    const missing = await request({ ...makeEnv(), DB: undefined }, { query: `?path=${PATH}` });
    assert.equal(missing.status, 503);
    const failing = makeEnv({
      prepare: () => {
        throw new Error('D1 down');
      },
    });
    assert.equal((await request(failing, { query: `?path=${PATH}` })).status, 503);
  });

  it('rejects other routes and methods', async () => {
    const env = makeEnv();
    assert.equal((await request(env, { method: 'DELETE' })).status, 405);
    const other = await worker.fetch(new Request('https://views.amrithnath.dev/', { headers: { Origin: ORIGIN } }), env);
    assert.equal(other.status, 404);
  });
});

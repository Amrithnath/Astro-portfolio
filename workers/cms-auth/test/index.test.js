import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import worker from '../src/index.js';

const env = {
  ALLOWED_DOMAINS: 'amrithnath.dev',
  GITHUB_CLIENT_ID: 'Iv1.test',
  GITHUB_CLIENT_SECRET: 'secret',
};
const AUTH = 'https://cms-auth.amrithnath.dev';

const get = (path, headers = {}) => worker.fetch(new Request(`${AUTH}${path}`, { headers }), env);

const signIn = async () => {
  const response = await get('/auth?provider=github&site_id=amrithnath.dev&scope=repo');
  const location = new URL(response.headers.get('Location'));
  const cookie = response.headers.get('Set-Cookie').split(';')[0];
  return { response, location, cookie };
};

afterEach(() => mock.restoreAll());

describe('/auth', () => {
  it('redirects to GitHub with state, PKCE and an HttpOnly cookie', async () => {
    const { response, location, cookie } = await signIn();
    assert.equal(response.status, 302);
    assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(location.searchParams.get('redirect_uri'), `${AUTH}/callback`);
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.match(location.searchParams.get('code_challenge'), /^[\w-]{43}$/);
    assert.equal(location.searchParams.get('scope'), null);
    assert.equal(cookie, `__Host-cms-oauth=${location.searchParams.get('state')}.${cookie.split('.')[1]}`);
    assert.match(response.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax; Path=\//);
  });

  it('rejects sites that are not allowed', async () => {
    const response = await get('/auth?provider=github&site_id=evil.example');
    assert.equal(response.status, 400);
    assert.match(await response.text(), /UNSUPPORTED_DOMAIN/);
  });

  it('fails closed without ALLOWED_DOMAINS', async () => {
    const response = await worker.fetch(
      new Request(`${AUTH}/auth?provider=github&site_id=amrithnath.dev`),
      { ...env, ALLOWED_DOMAINS: '' },
    );
    assert.equal(response.status, 400);
    assert.match(await response.text(), /MISCONFIGURED_CLIENT/);
  });

  it('rejects other providers', async () => {
    const response = await get('/auth?provider=gitlab&site_id=amrithnath.dev');
    assert.match(await response.text(), /UNSUPPORTED_BACKEND/);
  });
});

describe('/callback', () => {
  it('rejects a state that does not match the cookie', async () => {
    const { cookie } = await signIn();
    const fetchMock = mock.method(globalThis, 'fetch');
    const response = await get(`/callback?code=abc&state=${'x'.repeat(43)}`, { Cookie: cookie });
    assert.match(await response.text(), /CSRF_DETECTED/);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('rejects a callback without the cookie', async () => {
    const { location } = await signIn();
    const response = await get(`/callback?code=abc&state=${location.searchParams.get('state')}`);
    assert.match(await response.text(), /CSRF_DETECTED/);
  });

  it('exchanges the code with the PKCE verifier and posts only to allowed origins', async () => {
    const { location, cookie } = await signIn();
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      Response.json({ access_token: 'ghu_token</script>' }),
    );
    const response = await get(
      `/callback?code=abc&state=${location.searchParams.get('state')}`,
      { Cookie: cookie },
    );
    const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
    assert.equal(body.code_verifier, cookie.split('.')[1]);
    assert.equal(body.redirect_uri, `${AUTH}/callback`);

    const html = await response.text();
    const csp = response.headers.get('Content-Security-Policy');
    const nonce = csp.match(/'nonce-([\w-]+)'/)[1];
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
    assert.ok(html.includes(`<script nonce="${nonce}">`));
    assert.ok(!html.includes('ghu_token</script>'), 'token must be escaped inside the script');
    assert.ok(html.includes('"origins":["https://amrithnath.dev"]'));
    assert.doesNotMatch(html, /postMessage\([^)]*'\*'/);
  });

  it('reports a GitHub error without a token', async () => {
    const { location, cookie } = await signIn();
    mock.method(globalThis, 'fetch', async () => Response.json({ error: 'bad_verification_code' }));
    const response = await get(
      `/callback?code=abc&state=${location.searchParams.get('state')}`,
      { Cookie: cookie },
    );
    assert.equal(response.status, 400);
    assert.match(await response.text(), /TOKEN_REQUEST_FAILED/);
  });
});

it('returns 404 for other paths', async () => {
  assert.equal((await get('/')).status, 404);
});

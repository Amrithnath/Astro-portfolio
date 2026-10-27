// GitHub sign-in for Sveltia CMS at /admin, deployed as a Cloudflare Worker.
// Based on Sveltia CMS Authenticator (MIT, see ../LICENSE), trimmed to GitHub and hardened:
// - fails closed when ALLOWED_DOMAINS is unset and only hands tokens to exact https origins;
// - binds the flow to the browser with a state cookie and PKCE (S256);
// - serves the popup with a nonce-based CSP and no caching.
// Works with a GitHub App (user tokens expire after 8 hours) or an OAuth App.

const COOKIE = '__Host-cms-oauth';
const COOKIE_MAX_AGE = 600;
const PROVIDER = 'github';

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const randomString = (size = 32) => base64url(crypto.getRandomValues(new Uint8Array(size)));

const challengeFor = async (verifier) =>
  base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );

export const allowedHosts = (env) =>
  (env.ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host));

const allowedOrigins = (env) => allowedHosts(env).map((host) => `https://${host}`);

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const readCookie = (request) => {
  const match = request.headers
    .get('Cookie')
    ?.match(/(?:^|;\s*)__Host-cms-oauth=([\w-]{43})\.([\w-]{43})(?:;|$)/);
  return match ? { state: match[1], verifier: match[2] } : null;
};

const clearCookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

const securityHeaders = (nonce) => ({
  'Cache-Control': 'no-store',
  'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
});

// Implements the Netlify/Decap popup handshake Sveltia CMS expects: announce, wait for the opener
// to answer, then post the result back to that opener's origin only if it is on the allowlist.
export const popup = ({ env, token, error, errorCode }) => {
  const nonce = randomString(16);
  const state = token ? 'success' : 'error';
  const content = token ? { provider: PROVIDER, token } : { provider: PROVIDER, error, errorCode };
  const message = `authorization:${PROVIDER}:${state}:${JSON.stringify(content)}`;
  const data = JSON.stringify({ origins: allowedOrigins(env), message }).replaceAll('<', '\\u003c');

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head><body>
<script nonce="${nonce}">
(() => {
  const { origins, message } = ${data};
  window.addEventListener('message', ({ data, origin }) => {
    if (data !== 'authorizing:${PROVIDER}' || !origins.includes(origin)) return;
    window.opener?.postMessage(message, origin);
  });
  for (const origin of origins) window.opener?.postMessage('authorizing:${PROVIDER}', origin);
})();
</script></body></html>`,
    {
      status: token ? 200 : 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': clearCookie,
        ...securityHeaders(nonce),
      },
    },
  );
};

const fail = (env, errorCode, error) => popup({ env, errorCode, error });

const handleAuth = async (request, env) => {
  const { origin, searchParams } = new URL(request.url);
  const hosts = allowedHosts(env);

  if (searchParams.get('provider') !== PROVIDER) {
    return fail(env, 'UNSUPPORTED_BACKEND', 'Only GitHub sign-in is supported.');
  }
  if (!hosts.length) {
    return fail(env, 'MISCONFIGURED_CLIENT', 'ALLOWED_DOMAINS is not configured.');
  }
  if (!hosts.includes((searchParams.get('site_id') ?? '').toLowerCase())) {
    return fail(env, 'UNSUPPORTED_DOMAIN', 'This site is not allowed to use the authenticator.');
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return fail(env, 'MISCONFIGURED_CLIENT', 'GitHub client ID or secret is not configured.');
  }

  const state = randomString();
  const verifier = randomString();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${origin}/callback`,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    allow_signup: 'false',
  });
  // OAuth Apps need a scope; GitHub Apps ignore it and use the app's repository permissions.
  if (env.GITHUB_SCOPE) params.set('scope', env.GITHUB_SCOPE);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': `${COOKIE}=${state}.${verifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
    },
  });
};

const handleCallback = async (request, env) => {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const cookie = readCookie(request);

  if (!allowedHosts(env).length || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return fail(env, 'MISCONFIGURED_CLIENT', 'The authenticator is not configured.');
  }
  if (!code) {
    return fail(env, 'AUTH_CODE_REQUEST_FAILED', 'GitHub did not return an authorization code.');
  }
  if (!cookie || !safeEqual(searchParams.get('state') ?? '', cookie.state)) {
    return fail(env, 'CSRF_DETECTED', 'Sign-in state did not match. Please try again.');
  }

  let result;
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/callback`,
        code_verifier: cookie.verifier,
      }),
    });
    result = await response.json();
  } catch {
    return fail(env, 'TOKEN_REQUEST_FAILED', 'Could not reach GitHub. Please try again.');
  }

  if (typeof result?.access_token !== 'string' || !result.access_token) {
    return fail(env, 'TOKEN_REQUEST_FAILED', 'GitHub did not issue an access token.');
  }
  return popup({ env, token: result.access_token });
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && (pathname === '/auth' || pathname === '/oauth/authorize')) {
      return handleAuth(request, env);
    }
    if (request.method === 'GET' && (pathname === '/callback' || pathname === '/oauth/redirect')) {
      return handleCallback(request, env);
    }
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  },
};

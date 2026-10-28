// Browser-only probes for the privacy check. Everything stays in memory on this page; the only
// network requests are the same-origin ad bait, the endoflife.date release list (skipped with
// --offline) and, with --stun, one STUN request to Cloudflare.
import {
  describeKey,
  fingerprintVerdict,
  parseBrowser,
  parseCandidates,
  signalsVerdict,
  supportVerdict,
  webrtcVerdict,
  type Brand,
  type CheckId,
  type CheckResult,
  type FingerprintSignal,
  type Release,
  type RunOptions,
  type Status,
  type Verdict,
} from './checks';

type Nav = Navigator & {
  globalPrivacyControl?: boolean;
  deviceMemory?: number;
  brave?: { isBrave?: () => Promise<boolean> };
  userAgentData?: {
    brands?: Brand[];
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{ fullVersionList?: Brand[] }>;
  };
};

const nav = navigator as Nav;

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

const result = (id: CheckId, verdict: Verdict): CheckResult => ({ id, ...verdict });

export async function checkSignals(): Promise<CheckResult> {
  return result('signals', signalsVerdict(navigator.doNotTrack, nav.globalPrivacyControl));
}

export async function checkBlocker(): Promise<CheckResult> {
  const bait = document.createElement('div');
  bait.className = 'ad ads adsbox ad-banner ad-placement doubleclick sponsored-ad pub_300x250';
  bait.setAttribute('aria-hidden', 'true');
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:300px;height:250px;';
  bait.innerHTML = '&nbsp;';
  document.body.append(bait);
  await new Promise(resolve => setTimeout(resolve, 150));
  const style = getComputedStyle(bait);
  const hidden =
    !bait.isConnected || bait.offsetHeight === 0 || style.display === 'none' || style.visibility === 'hidden';
  bait.remove();

  // The bait file loads normally; blockers reject the request outright.
  const request = await withTimeout(
    fetch(`/pagead/ads.js?_=${Date.now()}`, { cache: 'no-store', credentials: 'omit' }).then(
      response => (response.ok ? ('allowed' as const) : ('blocked' as const)),
      () => 'blocked' as const
    ),
    3000,
    'blocked' as const
  );

  const details = [
    `cosmetic filter (ad-like element): ${hidden ? 'hidden' : 'visible'}`,
    `network filter (/pagead/ads.js): ${request}`,
  ];
  if (hidden || request === 'blocked') {
    return result('blocker', { status: 'pass', summary: 'A content blocker is active.', details });
  }
  details.push('Some blockers (e.g. Safari content blockers) only act on third-party URLs, so this can miss them.');
  return result('blocker', { status: 'warn', summary: 'No content blocker detected.', details });
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function drawCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 60;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.textBaseline = 'top';
  context.font = "16px 'Arial'";
  context.fillStyle = '#f60';
  context.fillRect(100, 1, 62, 20);
  context.fillStyle = '#069';
  context.fillText('amrith@portfolio ~$ 🦊', 2, 15);
  context.fillStyle = 'rgba(102, 204, 0, 0.7)';
  context.fillText('amrith@portfolio ~$ 🦊', 4, 17);
  return canvas.toDataURL();
}

function webglRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'unavailable';
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(renderer || 'hidden');
  } catch {
    return 'unavailable';
  }
}

const FONTS = [
  'Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Helvetica Neue',
  'Menlo', 'Segoe UI', 'SF Pro Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Ubuntu', 'Verdana',
  'Roboto', 'Noto Sans', 'DejaVu Sans', 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Garamond', 'Futura',
];

function installedFonts() {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return [];
  const sample = 'mmmmmmmmmmlli10OO@#';
  const width = (font: string) => {
    context.font = `72px ${font}`;
    return context.measureText(sample).width;
  };
  const bases = ['monospace', 'sans-serif', 'serif'];
  const baseline = bases.map(width);
  return FONTS.filter(font => bases.some((base, index) => width(`'${font}', ${base}`) !== baseline[index]));
}

export async function checkFingerprint(): Promise<CheckResult> {
  const first = drawCanvas();
  const second = drawCanvas();
  const randomised = Boolean(first) && first !== second;
  const fonts = installedFonts();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const signals: FingerprintSignal[] = [
    { label: 'agent', value: navigator.userAgent, weight: 'medium' },
    { label: 'languages', value: navigator.languages.join(', ') || navigator.language, weight: 'medium' },
    { label: 'timezone', value: `${timeZone} (UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60})`, weight: 'medium' },
    { label: 'screen', value: `${screen.width}×${screen.height} @${devicePixelRatio}x, ${screen.colorDepth}-bit`, weight: 'high' },
    { label: 'window', value: `${innerWidth}×${innerHeight}`, weight: 'medium' },
    {
      label: 'hardware',
      value: `${navigator.hardwareConcurrency || '?'} cores, ${nav.deviceMemory ? `${nav.deviceMemory} GB+` : '? GB'} memory, ${navigator.maxTouchPoints} touch points`,
      weight: 'medium',
    },
    { label: 'fonts', value: fonts.length ? `${fonts.length}/${FONTS.length} probed: ${fonts.join(', ')}` : 'none detected', weight: 'high' },
    { label: 'canvas', value: first ? `sha256 ${(await sha256(first)).slice(0, 16)}…` : 'unavailable', weight: 'high' },
    { label: 'webgl', value: webglRenderer(), weight: 'high' },
  ];
  return result('fingerprint', fingerprintVerdict(signals, randomised));
}

export async function checkStorage(): Promise<CheckResult> {
  const details: string[] = [];
  const cookies = document.cookie ? document.cookie.split(';').map(cookie => cookie.split('=')[0].trim()) : [];
  details.push(`cookies: ${cookies.length ? cookies.join(', ') : 'none readable by scripts'}`);
  const listStorage = (label: string, storage: Storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => key !== null
    );
    if (!keys.length) details.push(`${label}: empty`);
    for (const key of keys) details.push(`${label}: ${key} → ${describeKey(key)}`);
    return keys.length;
  };
  let keys = 0;
  try {
    keys += listStorage('localStorage', localStorage);
    keys += listStorage('sessionStorage', sessionStorage);
  } catch {
    details.push('web storage: blocked by the browser');
  }
  const databases = await indexedDB?.databases?.().catch(() => []);
  details.push(`IndexedDB: ${databases?.length ? databases.map(db => db.name).join(', ') : 'none'}`);
  const caches = await window.caches?.keys().catch(() => []);
  details.push(`Cache Storage: ${caches?.length ? `${caches.join(', ')} (offline copy of pages)` : 'none'}`);
  const workers = await navigator.serviceWorker?.getRegistrations().catch(() => []);
  details.push(`service workers: ${workers?.length ? `${workers.length} (offline support)` : 'none'}`);
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  if (estimate?.usage !== undefined) {
    details.push(`usage: ${(estimate.usage / 1024).toFixed(0)} KB${persisted ? ', persistent' : ', evictable'}`);
  }
  details.push('Other sites\' data is isolated by the browser and cannot be read from here.');
  return result('storage', {
    status: cookies.length ? 'info' : 'pass',
    summary: cookies.length
      ? `${cookies.length} cookie${cookies.length === 1 ? '' : 's'} and ${keys} storage key${keys === 1 ? '' : 's'} on this site.`
      : keys
        ? `No cookies; ${keys} storage key${keys === 1 ? '' : 's'} on this site, each explained below.`
        : 'No cookies or saved keys on this site.',
    details,
  });
}

export async function checkWebRtc(stun: boolean): Promise<CheckResult> {
  if (typeof RTCPeerConnection === 'undefined') return result('webrtc', webrtcVerdict(false, [], stun));
  const lines: string[] = [];
  let connection: RTCPeerConnection | undefined;
  try {
    connection = new RTCPeerConnection({ iceServers: stun ? [{ urls: 'stun:stun.cloudflare.com:3478' }] : [] });
    connection.createDataChannel('privacy-check');
    const done = new Promise<void>(resolve => {
      connection!.addEventListener('icecandidate', event => {
        if (event.candidate?.candidate) lines.push(event.candidate.candidate);
        else resolve();
      });
    });
    await connection.setLocalDescription(await connection.createOffer());
    await withTimeout(done, stun ? 4000 : 2000, undefined);
  } catch {
    return result('webrtc', webrtcVerdict(false, [], stun));
  } finally {
    connection?.close();
  }
  return result('webrtc', webrtcVerdict(true, parseCandidates(lines), stun));
}

async function releases(product: 'chrome' | 'firefox'): Promise<Release[]> {
  const response = await fetch(`https://endoflife.date/api/v1/products/${product}/`, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`endoflife.date answered ${response.status}`);
  const data = (await response.json()) as { result?: { releases?: Release[] } };
  if (!Array.isArray(data.result?.releases)) throw new Error('Unexpected endoflife.date response');
  return data.result.releases;
}

export async function checkBrowser(offline: boolean): Promise<CheckResult> {
  let brands = nav.userAgentData?.brands ?? [];
  try {
    const high = await nav.userAgentData?.getHighEntropyValues?.(['fullVersionList']);
    if (high?.fullVersionList?.length) brands = high.fullVersionList;
  } catch {
    // Low-entropy brands are enough.
  }
  const isBrave = Boolean(await nav.brave?.isBrave?.().catch(() => false));
  const browser = parseBrowser(navigator.userAgent, brands, isBrave);
  const details = [`detected: ${browser.name} ${browser.version ?? '(version hidden)'}`];

  if (browser.name === 'Safari' || (/iPhone|iPad|iPod/.test(navigator.userAgent) && !browser.product)) {
    details.push('Safari and every iOS browser use WebKit, which updates with the operating system.');
    return result('browser', {
      status: 'info',
      summary: 'Support follows your OS version: keep macOS / iOS up to date via Software Update.',
      details,
    });
  }
  if (!browser.product) {
    return result('browser', { status: 'info', summary: 'Could not identify a browser with a public release list.', details });
  }
  if (offline) {
    details.push('Skipped the release-list lookup (--offline).');
    return result('browser', { status: 'info', summary: `Running ${browser.name} ${browser.major}; support not checked offline.`, details });
  }
  try {
    const verdict = supportVerdict(browser.major, await withTimeout(releases(browser.product), 5000, []));
    if (browser.viaEngine) details.push(`compared using its Chromium engine (${browser.major}); the browser's own patches may lag.`);
    if (verdict.latest) details.push(`latest ${browser.product === 'firefox' ? 'Firefox' : 'Chrome'} stable: ${verdict.latest} (source: endoflife.date)`);
    details.push('Supported does not mean vulnerability-free: restart when your browser asks to update.');
    return result('browser', { status: verdict.status, summary: verdict.summary, details });
  } catch (error) {
    details.push(`release list unavailable: ${error instanceof Error ? error.message : 'network error'}`);
    return result('browser', { status: 'info', summary: 'Could not reach endoflife.date to compare versions.', details });
  }
}

async function permission(name: string) {
  try {
    return (await navigator.permissions.query({ name } as PermissionDescriptor)).state;
  } catch {
    return 'unsupported';
  }
}

export async function checkContext(): Promise<CheckResult> {
  const https = location.protocol === 'https:';
  const details = [
    `connection: ${https ? 'HTTPS' : location.protocol.replace(':', '')}, secure context: ${isSecureContext ? 'yes' : 'no'}`,
    `cross-origin isolated: ${crossOriginIsolated ? 'yes' : 'no'}`,
    `cookies enabled: ${navigator.cookieEnabled ? 'yes' : 'no'}`,
    `referrer received: ${document.referrer ? new URL(document.referrer).origin : 'none'}`,
    `notifications: ${await permission('notifications')}, persistent storage: ${await permission('persistent-storage')}`,
    'camera, microphone and location are disabled for this whole site by its Permissions-Policy header.',
  ];
  let status: Status = 'pass';
  let summary = 'Served over HTTPS in a secure context.';
  if (navigator.webdriver) {
    status = 'info';
    summary = 'This browser reports it is controlled by automation (navigator.webdriver).';
  }
  if (!isSecureContext) {
    status = 'warn';
    summary = 'Not a secure context: data could be read or changed in transit.';
  }
  return result('context', { status, summary, details });
}

export function runChecks(options: RunOptions) {
  return [
    checkSignals,
    checkBlocker,
    checkFingerprint,
    checkStorage,
    () => checkWebRtc(options.stun),
    () => checkBrowser(options.offline),
    checkContext,
  ];
}

// Pure helpers for the in-browser privacy check (/privacy-check/). No DOM access here, so Node tests
// can import it; browser probes live in probes.ts.

export type Status = 'pass' | 'warn' | 'fail' | 'info';

export const STATUS_TAG: Record<Status, string> = {
  pass: '[ OK ]',
  warn: '[WARN]',
  fail: '[FAIL]',
  info: '[INFO]',
};

export const CHECK_IDS = ['signals', 'blocker', 'fingerprint', 'storage', 'webrtc', 'browser', 'context'] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface Verdict {
  status: Status;
  summary: string;
  details: string[];
}

export interface CheckResult extends Verdict {
  id: CheckId;
}

export interface CheckInfo {
  title: string;
  /** Exactly what the probe does. */
  how: string;
  /** What leaves the browser, if anything. */
  sends: string;
  why: string;
  fix: string;
}

export const CHECKS: Record<CheckId, CheckInfo> = {
  signals: {
    title: 'Do Not Track and Global Privacy Control',
    how: 'Reads navigator.doNotTrack and navigator.globalPrivacyControl.',
    sends: 'Nothing.',
    why: 'GPC is a legally recognised opt-out of selling or sharing data in several US states (e.g. California, Colorado) and is honoured by this site. DNT is widely ignored and is itself an extra fingerprinting bit.',
    fix: 'Turn on GPC: built into Firefox (Settings → Privacy), Brave and DuckDuckGo; in Chrome use an extension such as Privacy Badger. Prefer GPC over DNT.',
  },
  blocker: {
    title: 'Content and ad blocker',
    how: 'Adds an invisible element with common ad class names and requests an empty bait file on this site with an ad-like address (/pagead/ads.js), then checks whether either was blocked.',
    sends: 'One request to this site for the empty bait file.',
    why: 'Ad and tracking networks are the main way your browsing is followed across sites. Blocking them also cuts page weight and malicious ads.',
    fix: 'Install uBlock Origin (Firefox) or uBlock Origin Lite (Chrome/Edge), or use a browser with built-in blocking such as Brave.',
  },
  fingerprint: {
    title: 'Browser fingerprint',
    how: 'Reads the signals any site can read without asking: user agent, languages, time zone, screen and window sizes, CPU cores, memory, touch support, installed fonts (by measuring text), a hash of a canvas drawing and the WebGL graphics card name. The canvas is drawn twice to detect randomisation.',
    sends: 'Nothing. This page fingerprints you to show how it works; the values stay on screen only and are discarded when you leave.',
    why: 'Combined, these signals can single out a browser without cookies, so clearing cookies alone does not stop tracking.',
    fix: 'Use a browser that blends in or randomises: Tor Browser, Mullvad Browser, Brave (randomises canvas and WebGL) or Firefox with fingerprinting protection. Avoid rare fonts and extensions that change pages.',
  },
  storage: {
    title: 'Storage and cookies (this site)',
    how: 'Lists cookie names, localStorage and sessionStorage keys, IndexedDB databases, Cache Storage, service workers and storage usage for this origin.',
    sends: 'Nothing.',
    why: 'Browsers isolate storage per site, so a page can only see its own data, never other sites\'. This shows exactly what this portfolio keeps on your device and why.',
    fix: 'Clear this site\'s data from the padlock / site settings menu, or set your browser to delete cookies and site data when it closes.',
  },
  webrtc: {
    title: 'WebRTC IP exposure',
    how: 'Opens an RTCPeerConnection with no servers and collects ICE candidates (the addresses WebRTC would share with a peer). With --stun it also asks Cloudflare\'s public STUN server (stun.cloudflare.com) to reflect your public address.',
    sends: 'Nothing by default. With --stun, one STUN request to Cloudflare, which sees your IP address like any server you contact.',
    why: 'WebRTC can reveal local network addresses and, through STUN, your real public IP, which can bypass some VPN or proxy setups.',
    fix: 'Current browsers hide local addresses behind random .local names. VPN users should confirm --stun shows the VPN\'s address. uBlock Origin can stop WebRTC leaking local IPs (Settings → Privacy).',
  },
  browser: {
    title: 'Browser version and support',
    how: 'Reads the browser name and version (User-Agent Client Hints when available) and fetches the public Chrome or Firefox release list from endoflife.date to see whether that major version still receives security fixes. Other Chromium browsers are compared by engine version.',
    sends: 'One request to endoflife.date for the public release list; it does not include your version, but the service sees your IP. --offline skips it.',
    why: 'Browsers fix actively exploited vulnerabilities every few weeks, and only supported releases get the fixes. Being up to date does not mean no vulnerabilities exist.',
    fix: 'Keep automatic updates on and restart the browser when it asks. Safari updates with macOS and iOS: use Software Update.',
  },
  context: {
    title: 'Connection and page security',
    how: 'Checks HTTPS and secure context, cross-origin isolation, whether cookies are enabled, automation flags, the referrer this page received and permission states.',
    sends: 'Nothing.',
    why: 'Secure contexts protect data in transit and gate powerful APIs. Permissions you granted long ago keep working silently.',
    fix: 'Turn on HTTPS-only mode, review site permissions in browser settings now and then, and prefer browsers that trim referrers by default.',
  },
};

export interface RunOptions {
  offline: boolean;
  stun: boolean;
}

export type Command =
  | { kind: 'run'; options: RunOptions }
  | { kind: 'run-help' }
  | { kind: 'explain'; id?: CheckId; unknown?: string }
  | { kind: 'help' }
  | { kind: 'clear' }
  | { kind: 'copy' }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string };

const RUN_FLAGS = new Set(['--offline', '--stun']);

export function parseCommand(raw: string): Command {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { kind: 'empty' };
  const [first, second, ...rest] = words;
  if (first === 'run' && second === 'check') {
    if (rest.includes('--help') || rest.includes('-h')) return { kind: 'run-help' };
    if (rest.some(flag => !RUN_FLAGS.has(flag))) return { kind: 'unknown', input: raw.trim() };
    return { kind: 'run', options: { offline: rest.includes('--offline'), stun: rest.includes('--stun') } };
  }
  if (first === 'explain' && words.length <= 2) {
    if (!second) return { kind: 'explain' };
    return (CHECK_IDS as readonly string[]).includes(second)
      ? { kind: 'explain', id: second as CheckId }
      : { kind: 'explain', unknown: second };
  }
  if (words.length === 1 && first === 'help') return { kind: 'help' };
  if (words.length === 1 && first === 'clear') return { kind: 'clear' };
  if (words.length === 1 && first === 'copy') return { kind: 'copy' };
  return { kind: 'unknown', input: raw.trim() };
}

export interface BrowserInfo {
  name: string;
  /** endoflife.date product whose release list applies, if any. */
  product?: 'chrome' | 'firefox';
  major?: number;
  version?: string;
  /** True when support is inferred from the Chromium engine rather than the browser itself. */
  viaEngine?: boolean;
}

export interface Brand {
  brand: string;
  version: string;
}

const CHROMIUM_FORKS = ['Microsoft Edge', 'Opera', 'Brave', 'Vivaldi', 'Samsung Internet', 'YaBrowser'];

export function parseBrowser(userAgent: string, brands: Brand[] = [], isBrave = false): BrowserInfo {
  const real = brands.filter(({ brand }) => !/not.?a.?brand/i.test(brand));
  const chromium = real.find(({ brand }) => brand === 'Chromium');
  if (chromium) {
    const branded =
      real.find(({ brand }) => CHROMIUM_FORKS.includes(brand)) ?? real.find(({ brand }) => brand === 'Google Chrome');
    const name = isBrave ? 'Brave' : (branded?.brand ?? 'Chromium');
    const fork = name !== 'Google Chrome' && name !== 'Chromium';
    return {
      name,
      product: 'chrome',
      major: Number.parseInt(chromium.version, 10),
      version: fork ? `${branded?.version ?? ''} (Chromium ${chromium.version})`.trim() : (branded ?? chromium).version,
      viaEngine: fork,
    };
  }

  const firefox = userAgent.match(/(Firefox|FxiOS)\/(\d+)(\.[\d.]+)?/);
  if (firefox) {
    const major = Number(firefox[2]);
    // Firefox on iOS uses WebKit and follows its own release train.
    return { name: 'Firefox', product: firefox[1] === 'FxiOS' ? undefined : 'firefox', major, version: `${major}${firefox[3] ?? ''}` };
  }
  const chrome = userAgent.match(/(Chrome|CriOS)\/(\d+)(\.[\d.]+)?/);
  if (chrome) {
    const major = Number(chrome[2]);
    const ios = chrome[1] === 'CriOS';
    const name = /Edg(A|iOS)?\//.test(userAgent)
      ? 'Microsoft Edge'
      : isBrave
        ? 'Brave'
        : /OPR\//.test(userAgent)
          ? 'Opera'
          : 'Google Chrome';
    return {
      name,
      product: ios ? undefined : 'chrome',
      major,
      version: `${major}${chrome[3] ?? ''}`,
      viaEngine: !ios && name !== 'Google Chrome',
    };
  }
  const safari = userAgent.match(/Version\/(\d+)(\.[\d.]+)?.*Safari\//);
  if (safari) return { name: 'Safari', major: Number(safari[1]), version: `${safari[1]}${safari[2] ?? ''}` };
  return { name: 'Unknown browser' };
}

export interface Release {
  name: string;
  isMaintained: boolean;
  latest?: { name: string } | null;
}

export interface SupportVerdict {
  status: Status;
  summary: string;
  latest?: string;
}

/** Compare a major version with an endoflife.date release list. */
export function supportVerdict(major: number | undefined, releases: Release[]): SupportVerdict {
  const numbered = releases
    .map(release => ({ release, major: Number.parseInt(release.name, 10) }))
    .filter(entry => Number.isFinite(entry.major))
    .sort((a, b) => b.major - a.major);
  const newest = numbered[0];
  const latest = newest ? (newest.release.latest?.name ?? newest.release.name) : undefined;
  if (!major || !newest) return { status: 'info', summary: 'Could not compare this version with the release list.', latest };
  if (major > newest.major) return { status: 'pass', summary: `Version ${major} is newer than the latest stable (${newest.major}): a beta or dev channel.`, latest };
  const behind = newest.major - major;
  if (numbered.find(entry => entry.major === major)?.release.isMaintained) {
    return {
      status: 'pass',
      summary: behind
        ? `Version ${major} still receives security fixes (newest is ${newest.major}).`
        : `Version ${major} is the newest stable release and receives security fixes.`,
      latest,
    };
  }
  return {
    status: behind > 2 ? 'fail' : 'warn',
    summary: `Version ${major} no longer receives security fixes: ${behind} major release${behind === 1 ? '' : 's'} behind ${newest.major}.`,
    latest,
  };
}

export type CandidateKind = 'mdns' | 'private' | 'public' | 'loopback';

export interface Candidate {
  address: string;
  type: string;
  kind: CandidateKind;
}

const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

export function classifyAddress(address: string): CandidateKind {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (value.endsWith('.local')) return 'mdns';
  if (value === '127.0.0.1' || value === '::1') return 'loopback';
  if (PRIVATE_V4.test(value) || /^f[cd][0-9a-f]{2}:/.test(value) || /^fe[89ab][0-9a-f]:/.test(value)) return 'private';
  return 'public';
}

/** Parse ICE candidate lines ("candidate:<foundation> <component> <protocol> <priority> <address> <port> typ <type>"). */
export function parseCandidates(lines: string[]): Candidate[] {
  const seen = new Map<string, Candidate>();
  for (const line of lines) {
    const parts = line.replace(/^a=/, '').trim().split(/\s+/);
    const typIndex = parts.indexOf('typ');
    if (!parts[0]?.startsWith('candidate:') || typIndex < 6 || !parts[4]) continue;
    const address = parts[4];
    const type = parts[typIndex + 1] ?? 'unknown';
    const key = `${type}:${address}`;
    if (!seen.has(key)) seen.set(key, { address, type, kind: classifyAddress(address) });
  }
  return [...seen.values()];
}

export function webrtcVerdict(available: boolean, candidates: Candidate[], stun: boolean): Verdict {
  if (!available) {
    return { status: 'pass', summary: 'WebRTC is unavailable or disabled, so it cannot expose addresses.', details: [] };
  }
  const local = candidates.filter(candidate => candidate.type === 'host');
  const reflexive = candidates.filter(candidate => candidate.type === 'srflx');
  const leaked = local.filter(candidate => candidate.kind === 'private' || candidate.kind === 'public');
  const details = [
    ...local.map(candidate => `host  ${candidate.address} (${candidate.kind === 'mdns' ? 'random mDNS name' : `${candidate.kind} address`})`),
    ...reflexive.map(candidate => `srflx ${candidate.address} (public address the STUN server saw)`),
  ];
  if (!candidates.length) details.push('No candidates were gathered: WebRTC may be restricted by the browser or an extension.');
  if (!stun) details.push('Run `run check --stun` to also test public IP exposure (contacts Cloudflare STUN).');
  else if (reflexive.length) details.push('If you use a VPN or proxy, that public address should belong to it, not your ISP.');
  else details.push('The STUN server did not answer: UDP may be blocked, or WebRTC is limited.');
  if (leaked.length) {
    return {
      status: 'warn',
      summary: `WebRTC exposes ${leaked.length} local network address${leaked.length === 1 ? '' : 'es'} to any page.`,
      details,
    };
  }
  return {
    status: stun && reflexive.length ? 'info' : 'pass',
    summary: stun && reflexive.length
      ? 'Local addresses are hidden; your public address is visible to WebRTC, as it is to every server.'
      : 'Local addresses are hidden behind random mDNS names or not exposed.',
    details,
  };
}

export function signalsVerdict(doNotTrack: string | null | undefined, globalPrivacyControl: boolean | undefined): Verdict {
  const dnt = doNotTrack === '1' || doNotTrack === 'yes';
  const details = [
    `Global Privacy Control: ${globalPrivacyControl === undefined ? 'not supported by this browser' : globalPrivacyControl ? 'on' : 'off'}`,
    `Do Not Track: ${dnt ? 'on' : 'off'}`,
  ];
  if (globalPrivacyControl) {
    return { status: 'pass', summary: 'Global Privacy Control is on: sites must treat you as opted out where the law requires it.', details };
  }
  if (dnt) {
    return { status: 'warn', summary: 'Only Do Not Track is on. It is mostly ignored; Global Privacy Control has legal weight.', details };
  }
  return { status: 'warn', summary: 'No privacy signal is sent to websites.', details };
}

export interface FingerprintSignal {
  label: string;
  value: string;
  /** Rough identifying power, after EFF Cover Your Tracks and AmIUnique findings. */
  weight: 'low' | 'medium' | 'high';
}

export function fingerprintVerdict(signals: FingerprintSignal[], randomised: boolean): Verdict {
  const high = signals.filter(signal => signal.weight === 'high').length;
  const details = signals.map(signal => `${signal.label.padEnd(10)} ${signal.value} [${signal.weight}]`);
  details.push('Discarded when you leave this page: nothing was sent or stored.');
  if (randomised) {
    return { status: 'pass', summary: 'Canvas output changes between reads, so your browser randomises fingerprints.', details };
  }
  return {
    status: high >= 3 ? 'warn' : 'info',
    summary: `${signals.length} signals readable without permission, ${high} highly identifying; together they likely make this browser unique.`,
    details,
  };
}

/** What each of this site's own storage keys is for, so the storage review can explain them. */
const SITE_KEYS: [RegExp, string][] = [
  [/^portfolio-theme$/, 'your chosen colour theme'],
  [/^portfolio-layout-theme$/, 'colour theme from an older version (migrated on next load)'],
  [/^portfolio-viewed:/, 'article already counted by the view counter'],
  [/^portfolio-carbon:/, 'cached Website Carbon result (1 day)'],
  [/^portfolio-session-bytes$/, 'bytes loaded this session, for the carbon estimate'],
];

export function describeKey(key: string): string {
  return SITE_KEYS.find(([pattern]) => pattern.test(key))?.[1] ?? 'not set by this site (an extension or an older version)';
}

export function formatReport(results: CheckResult[]): string {
  return results
    .map(result =>
      [`${STATUS_TAG[result.status]} ${result.id.padEnd(11)} ${result.summary}`, ...result.details.map(line => `       ${line}`)].join('\n')
    )
    .join('\n');
}

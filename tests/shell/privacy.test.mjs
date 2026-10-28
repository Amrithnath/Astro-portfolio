import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeKey,
  parseBrowser,
  parseCandidates,
  parseCommand,
  signalsVerdict,
  supportVerdict,
  webrtcVerdict,
} from '../../src/features/privacy/checks.ts';

test('privacy check commands follow the terminal syntax', () => {
  assert.deepEqual(parseCommand('  Run   CHECK '), { kind: 'run', options: { offline: false, stun: false } });
  assert.deepEqual(parseCommand('run check --stun --offline'), { kind: 'run', options: { offline: true, stun: true } });
  assert.deepEqual(parseCommand('run check --help'), { kind: 'run-help' });
  assert.deepEqual(parseCommand('run check -h'), { kind: 'run-help' });
  assert.equal(parseCommand('run check --all').kind, 'unknown');
  assert.equal(parseCommand('run').kind, 'unknown');
  assert.deepEqual(parseCommand('explain webrtc'), { kind: 'explain', id: 'webrtc' });
  assert.deepEqual(parseCommand('explain cookies'), { kind: 'explain', unknown: 'cookies' });
  assert.equal(parseCommand('').kind, 'empty');
  assert.equal(parseCommand('rm -rf /').kind, 'unknown');
});

const chromeUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

test('browsers map to the release list that applies to them', () => {
  assert.deepEqual(
    parseBrowser(chromeUa, [
      { brand: 'Not.A/Brand', version: '99' },
      { brand: 'Chromium', version: '156.0.7000.1' },
      { brand: 'Google Chrome', version: '156.0.7000.1' },
    ]),
    { name: 'Google Chrome', product: 'chrome', major: 156, version: '156.0.7000.1', viaEngine: false }
  );
  const edge = parseBrowser(chromeUa, [
    { brand: 'Chromium', version: '155' },
    { brand: 'Microsoft Edge', version: '155' },
  ]);
  assert.equal(edge.name, 'Microsoft Edge');
  assert.equal(edge.viaEngine, true);
  assert.equal(parseBrowser(chromeUa, [{ brand: 'Chromium', version: '156' }], true).name, 'Brave');
  assert.deepEqual(
    parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:159.0) Gecko/20100101 Firefox/159.0'),
    { name: 'Firefox', product: 'firefox', major: 159, version: '159.0' }
  );
  assert.equal(parseBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605 FxiOS/159.0 Mobile Safari/604').product, undefined);
  assert.equal(parseBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605 CriOS/156.0 Mobile Safari/604').product, undefined);
  assert.deepEqual(
    parseBrowser('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15'),
    { name: 'Safari', major: 19, version: '19.1' }
  );
});

test('support verdicts compare the major version with maintained releases', () => {
  const releases = [
    { name: '154', isMaintained: false },
    { name: '156', isMaintained: true, latest: { name: '156.0.7000.1' } },
    { name: '155', isMaintained: false },
    { name: '150', isMaintained: false },
  ];
  assert.equal(supportVerdict(156, releases).status, 'pass');
  assert.equal(supportVerdict(156, releases).latest, '156.0.7000.1');
  assert.equal(supportVerdict(157, releases).status, 'pass');
  assert.equal(supportVerdict(155, releases).status, 'warn');
  assert.equal(supportVerdict(150, releases).status, 'fail');
  assert.equal(supportVerdict(undefined, releases).status, 'info');
  assert.equal(supportVerdict(156, []).status, 'info');
});

test('WebRTC candidates flag exposed local addresses but not mDNS names', () => {
  const candidates = parseCandidates([
    'candidate:1 1 udp 2122260223 4b1f7c2e-1234-4d7a-9c1e-0a1b2c3d4e5f.local 54321 typ host generation 0',
    'a=candidate:1 1 udp 2122260223 4b1f7c2e-1234-4d7a-9c1e-0a1b2c3d4e5f.local 54321 typ host generation 0',
    'candidate:2 1 udp 1686052607 203.0.113.7 61000 typ srflx raddr 0.0.0.0 rport 0',
    'not a candidate',
  ]);
  assert.deepEqual(candidates.map(c => [c.type, c.kind]), [['host', 'mdns'], ['srflx', 'public']]);
  assert.equal(webrtcVerdict(true, candidates.slice(0, 1), false).status, 'pass');
  assert.equal(webrtcVerdict(true, candidates, true).status, 'info');
  assert.equal(webrtcVerdict(false, [], false).status, 'pass');
  const leaked = parseCandidates(['candidate:3 1 udp 2122260223 192.168.1.20 50000 typ host']);
  assert.equal(leaked[0].kind, 'private');
  assert.equal(webrtcVerdict(true, leaked, false).status, 'warn');
});

test('privacy signals prefer GPC and storage keys are explained', () => {
  assert.equal(signalsVerdict(null, true).status, 'pass');
  assert.equal(signalsVerdict('1', false).status, 'warn');
  assert.match(signalsVerdict('1', undefined).details[0], /not supported/);
  assert.equal(describeKey('portfolio-theme'), 'your chosen colour theme');
  assert.match(describeKey('portfolio-carbon:/about/'), /Website Carbon/);
  assert.match(describeKey('someone-else'), /not set by this site/);
});

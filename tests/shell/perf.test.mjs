import assert from 'node:assert/strict';
import test from 'node:test';
import { carbonEstimate, formatBytes, formatMs, rateMetric, transferTotals } from '../../src/features/terminal/perf.ts';

test('carbon estimate follows SWD v4 on the global grid and rates it', () => {
  const oneMb = carbonEstimate(1e6);
  assert.equal(oneMb.grams.toFixed(4), '0.1482');
  assert.equal(oneMb.rating, 'C');
  assert.equal(carbonEstimate(200e3).rating, 'A+');
  assert.equal(carbonEstimate(5e6).rating, 'F');
  assert.equal(carbonEstimate(-1).grams, 0);
});

test('transfer totals separate network bytes from a cold first visit', () => {
  assert.deepEqual(
    transferTotals([
      { transferSize: 1200, encodedBodySize: 900 },
      { transferSize: 0, encodedBodySize: 5000 },
      {},
    ]),
    { transferred: 1200, firstVisit: 6200 }
  );
});

test('formatters keep pane values short', () => {
  assert.deepEqual([formatBytes(512), formatBytes(2048), formatBytes(15 * 1024 * 1024)], ['512 B', '2.0 KB', '15 MB']);
  assert.deepEqual([formatMs(42.4), formatMs(1534), formatMs(undefined)], ['42 ms', '1.53 s', 'n/a']);
});

test('Web Vitals verdicts use plain words at the Core Web Vitals thresholds', () => {
  assert.deepEqual(rateMetric('lcp', 2500), { rating: 'good', word: 'fast' });
  assert.deepEqual(rateMetric('lcp', 2501), { rating: 'ok', word: 'okay' });
  assert.deepEqual(rateMetric('ttfb', 1801), { rating: 'poor', word: 'slow' });
  assert.deepEqual(rateMetric('cls', 0.3), { rating: 'poor', word: 'jumpy' });
  assert.equal(rateMetric('fcp', undefined), undefined);
  assert.equal(rateMetric('fcp', Number.NaN), undefined);
});

// Pure helpers for the side-pane `top` monitor and `carbon --estimate` (Sustainable Web Design v4).

const KWH_PER_GB = 0.055 + 0.059 + 0.08 + 0.012 + 0.013 + 0.081;
const GLOBAL_GRID_G_PER_KWH = 494;
const RATINGS: [number, string][] = [
  [0.04, 'A+'],
  [0.079, 'A'],
  [0.145, 'B'],
  [0.209, 'C'],
  [0.278, 'D'],
  [0.359, 'E'],
];

export interface CarbonEstimate {
  grams: number;
  rating: string;
}

/** Grams of CO2e for transferring `bytes`, on the global average grid. */
export function carbonEstimate(bytes: number): CarbonEstimate {
  const grams = (Math.max(0, bytes) / 1e9) * KWH_PER_GB * GLOBAL_GRID_G_PER_KWH;
  return { grams, rating: RATINGS.find(([limit]) => grams <= limit)?.[1] ?? 'F' };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return 'n/a';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export interface TransferEntry {
  transferSize?: number;
  encodedBodySize?: number;
}

/** Bytes this view moved over the network, and what a first visit downloads (cache ignored). */
export function transferTotals(entries: TransferEntry[]): { transferred: number; firstVisit: number } {
  return entries.reduce(
    (totals, entry) => ({
      transferred: totals.transferred + (entry.transferSize ?? 0),
      firstVisit: totals.firstVisit + Math.max(entry.transferSize ?? 0, entry.encodedBodySize ?? 0),
    }),
    { transferred: 0, firstVisit: 0 }
  );
}

export type Rating = 'good' | 'ok' | 'poor';
export type RatedMetric = 'ttfb' | 'fcp' | 'lcp' | 'cls';

// Google's Core Web Vitals thresholds (web.dev/vitals): [good up to, needs improvement up to].
const THRESHOLDS: Record<RatedMetric, [number, number]> = {
  ttfb: [800, 1800],
  fcp: [1800, 3000],
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
};

const WORDS: Record<RatedMetric, Record<Rating, string>> = {
  ttfb: { good: 'fast', ok: 'okay', poor: 'slow' },
  fcp: { good: 'fast', ok: 'okay', poor: 'slow' },
  lcp: { good: 'fast', ok: 'okay', poor: 'slow' },
  cls: { good: 'steady', ok: 'shifty', poor: 'jumpy' },
};

/** Plain-language verdict for a Web Vitals value, or undefined when it was not measured. */
export function rateMetric(metric: RatedMetric, value: number | undefined): { rating: Rating; word: string } | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const [good, ok] = THRESHOLDS[metric];
  const rating: Rating = value <= good ? 'good' : value <= ok ? 'ok' : 'poor';
  return { rating, word: WORDS[metric][rating] };
}

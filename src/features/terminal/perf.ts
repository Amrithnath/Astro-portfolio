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

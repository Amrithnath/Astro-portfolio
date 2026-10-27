const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a `YYYY-MM` (or `YYYY`) value as `Oct 2025`; other values pass through unchanged. */
export function formatMonth(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value);
  if (!match) return value;
  const [, year, month] = match;
  const index = month ? Number(month) - 1 : -1;
  return index >= 0 && index < 12 ? `${MONTHS[index]} ${year}` : year;
}

/** Formats a start/end pair as `Oct 2018 – Oct 2025`, using `ongoing` when there is no end date. */
export function formatRange(start?: string | null, end?: string | null, ongoing = 'Present'): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : ongoing}`;
}

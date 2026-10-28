// Parses Release Please CHANGELOG.md headings into a compact `git log` style list.
export interface Release {
  version: string;
  date: string;
  url: string;
  summary: string;
}

const HEADING = /^## \[(\d+\.\d+\.\d+)\]\(([^)]+)\) \((\d{4}-\d{2}-\d{2})\)$/;
const ENTRY = /^\* (?:\*\*[^*]+:\*\* )?(?:\p{Extended_Pictographic}\uFE0F?\s*)?(.+?) \(\[[0-9a-f]{7}\]/u;

export function parseReleases(changelog: string, limit = 6): Release[] {
  const releases: Release[] = [];
  for (const line of changelog.split('\n')) {
    const heading = HEADING.exec(line.trim());
    if (heading) {
      if (releases.length === limit) break;
      const [, version, compare, date] = heading;
      const url = compare.replace(/\/compare\/.*$/, `/releases/tag/v${version}`);
      releases.push({ version, date, url, summary: '' });
      continue;
    }
    const current = releases.at(-1);
    const entry = current && !current.summary && ENTRY.exec(line.trim());
    if (entry) current.summary = entry[1];
  }
  return releases;
}

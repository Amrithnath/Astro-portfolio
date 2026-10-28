// Data for the wide-screen side panes (SidePanes.astro). Pure functions so they can be unit tested.
import type { ResumeCompendium, SkillItem } from '../resume/resume-compendium';

export interface PaneLink {
  href: string;
  label: string;
  depth?: number;
}

/** Per-page pane content; every field is optional and falls back to the page title/description. */
export interface PaneContext {
  /** man NAME line, e.g. `about - who I am`. */
  name?: string;
  synopsis?: string;
  description?: string;
  /** In-page anchors (article headings or page sections). */
  sections?: PaneLink[];
  seeAlso?: PaneLink[];
  /** Skill names or tags to show as meters; unmatched values fall back to the top skills. */
  skills?: string[];
  /** Show every skill grouped by category (resume). */
  allSkills?: boolean;
  /** Show technologies under each career entry (resume). */
  expandCareer?: boolean;
  /** Mark the career entry that was current on this date (articles). */
  focusDate?: Date;
}

export interface CareerCommit {
  id: string;
  start: string;
  end?: string;
  title: string;
  org: string;
  technologies: string[];
  head: boolean;
  focused: boolean;
}

const month = (value: string) => value.slice(0, 7);

export function careerGraph(
  { experience, education }: Pick<ResumeCompendium, 'experience' | 'education'>,
  focusDate?: Date
): CareerCommit[] {
  const focus = focusDate?.toISOString().slice(0, 7);
  const entries = [
    ...experience.map(job => ({
      id: job.id,
      start: month(job.startDate),
      end: job.endDate && month(job.endDate),
      title: job.position,
      org: job.company,
      technologies: job.technologies ?? [],
    })),
    ...education.map(edu => ({
      id: edu.id,
      start: month(edu.startDate),
      end: edu.endDate && month(edu.endDate),
      title: `${edu.degree} in ${edu.field}`,
      org: edu.institution,
      technologies: [],
    })),
  ].sort((a, b) => b.start.localeCompare(a.start));
  const focusedId = focus && entries.find(entry => entry.start <= focus && (!entry.end || focus < entry.end))?.id;
  return entries.map((entry, i) => ({ ...entry, head: i === 0 && !entry.end, focused: entry.id === focusedId }));
}

export const LEVEL_PERCENT: Record<SkillItem['level'], number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

export interface SkillMeter {
  name: string;
  level: SkillItem['level'];
  /** Bar fill: years relative to the most-practised skill, else the level. */
  percent: number;
  years?: number;
}

export interface SkillGroup {
  category: string;
  meters: SkillMeter[];
}

const meterFor =
  (maxYears: number) =>
  ({ name, level, yearsOfExperience: years }: SkillItem): SkillMeter => ({
    name,
    level,
    percent: years && maxYears ? Math.round((years / maxYears) * 100) : LEVEL_PERCENT[level],
    ...(years ? { years } : {}),
  });
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#]/g, '');

export function skillMeters(
  { skills }: Pick<ResumeCompendium, 'skills'>,
  { focus = [], all = false, limit = 8 }: { focus?: string[]; all?: boolean; limit?: number } = {}
): SkillGroup[] {
  const ordered = [...skills].sort((a, b) => a.priority - b.priority);
  const flat = ordered.flatMap(group => group.skills);
  const meter = meterFor(Math.max(0, ...flat.map(skill => skill.yearsOfExperience ?? 0)));
  if (all) return ordered.map(group => ({ category: group.category, meters: group.skills.map(meter) }));
  const wanted = new Set(focus.map(key));
  const matches = flat.filter(skill => wanted.has(key(skill.name)));
  if (matches.length) return [{ category: 'Used here', meters: matches.slice(0, limit).map(meter) }];
  const top = flat
    .map((skill, index) => ({ skill, index }))
    .sort(
      (a, b) =>
        LEVEL_PERCENT[b.skill.level] - LEVEL_PERCENT[a.skill.level] ||
        (b.skill.yearsOfExperience ?? 0) - (a.skill.yearsOfExperience ?? 0) ||
        a.index - b.index
    )
    .slice(0, limit)
    .map(({ skill }) => meter(skill));
  return [{ category: 'Top skills', meters: top }];
}

export interface NowItem {
  heading: string;
  text: string;
}

/** First paragraph under each `## heading`; nothing for placeholder entries or TODO text. */
export function nowItems(body: string | undefined, placeholder: boolean): NowItem[] {
  if (placeholder || !body) return [];
  return [...body.matchAll(/^##\s+(.+)\n+([^\n#][^\n]*)/gm)]
    .map(([, heading, text]) => ({ heading: heading.trim(), text: text.trim() }))
    .filter(item => item.text && !/^TODO\b/.test(item.text));
}

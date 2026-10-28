import { resumeCompendium as profile } from '../data/resume-compendium';
import { isWip } from '../data/wip';

export { profile };

export const absoluteProfileUrl = (value: string) =>
  new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).href;

export const profileLinks = [
  profile.contact.linkedin,
  profile.contact.github,
  profile.contact.twitter,
]
  .filter((value): value is string => Boolean(value))
  .map(absoluteProfileUrl);

export const excludedPrefixes = [
  '/wedding',
  '/photography',
  '/now',
  '/uses',
  '/search',
  '/photos',
  '/admin',
  '/api',
  '/terminal-full',
  '/work-in-progress',
  '/offline',
  '/404',
];

export function isIndexablePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (
    !excludedPrefixes.some(prefix => path.startsWith(prefix)) &&
    !['/blog', '/blogs'].includes(path) &&
    !isWip(path) &&
    !/\.[^/]+$/.test(path)
  );
}

const projectTechnologies = [...new Set(profile.projects.flatMap(project => project.technologies))];

export const pageDescriptions: Record<string, string> = {
  '/': profile.summary,
  '/about': `About ${profile.contact.name}: ${profile.summary}`,
  '/resume': `${profile.contact.name}'s experience, education, and skills. Read the resume or generate a customized download.`,
  '/projects': `Explore ${profile.contact.name}'s projects in ${projectTechnologies.slice(0, 8).join(', ')}.`,
  '/contact': `Contact ${profile.contact.name}, ${profile.contact.title}, by email or professional profile.`,
  '/privacy-policy': `Privacy policy for ${profile.contact.name}'s portfolio and messaging interactions.`,
};

export function personSchema(site: URL) {
  return {
    '@type': 'Person',
    '@id': new URL('/#person', site).href,
    name: profile.contact.name,
    jobTitle: profile.contact.title,
    description: profile.summary,
    url: site.href,
    sameAs: profileLinks,
    knowsAbout: [
      ...new Set(profile.skills.flatMap(category => category.skills.map(skill => skill.name))),
    ],
    alumniOf: profile.education.map(item => ({
      '@type': 'CollegeOrUniversity',
      name: item.institution,
    })),
    worksFor: profile.experience
      .filter(item => !item.endDate)
      .map(item => ({ '@type': 'Organization', name: item.company })),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

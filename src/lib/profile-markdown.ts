import { formatRange } from './format-date';
import { contentPath, getPublishedCollection } from './content';
import { absoluteProfileUrl, isIndexablePath, profile, profileLinks } from './seo';

export async function getPosts() {
  const documents = [
    ...(await getPublishedCollection('blog')),
    ...(await getPublishedCollection('projects')),
  ];
  return documents.map(entry => ({
    path: contentPath(entry),
    title: entry.data.title,
    description: entry.data.description,
    body: entry.body?.trim() || '',
  })).filter(post => isIndexablePath(post.path));
}

export const keyPages = [
  { path: '/', label: 'Home', description: profile.contact.title, markdown: '/index.md' },
  { path: '/about/', label: 'About', description: 'Professional background, education, and skills.', markdown: '/about.md' },
  { path: '/resume/', label: 'Resume', description: 'Experience, achievements, skills, and education; interactive resume downloads.', markdown: '/resume.md' },
  { path: '/projects/', label: 'Projects', description: 'Portfolio projects, technologies, and source links.', markdown: '/projects.md' },
  { path: '/contact/', label: 'Contact', description: 'Email and professional profiles.' },
].filter(page => isIndexablePath(page.path));

const bullets = (values: string[]) => values.map(value => `- ${value}`).join('\n');

export function contactMarkdown(): string {
  return [
    `- Email: [${profile.contact.email}](mailto:${profile.contact.email})`,
    ...(profile.contact.location ? [`- Location: ${profile.contact.location}`] : []),
    ...[...new Set([
      ...(profile.contact.website ? [absoluteProfileUrl(profile.contact.website)] : []),
      ...profileLinks,
    ])].map(url => `- [${url}](${url})`),
  ].join('\n');
}

export function experienceMarkdown(): string {
  return profile.experience.map(item => [
    `### ${item.position} — ${item.company}`,
    `${formatRange(item.startDate, item.endDate)}${item.location ? ` | ${item.location}` : ''}`,
    item.description,
    bullets(item.achievements),
    item.technologies?.length ? `Technologies: ${item.technologies.join(', ')}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n');
}

export function educationMarkdown(): string {
  return profile.education.map(item => [
    `### ${item.institution}`,
    `${item.degree} in ${item.field} | ${formatRange(item.startDate, item.endDate)}`,
    item.location || '',
    bullets(item.activities || []),
  ].filter(Boolean).join('\n\n')).join('\n\n');
}

export function skillsMarkdown(): string {
  return bullets(profile.skills.map(category =>
    `**${category.category}:** ${category.skills.map(skill => skill.name).join(', ')}`,
  ));
}

export function projectsMarkdown(): string {
  return profile.projects.map(item => [
    `### ${item.name}`,
    item.longDescription || item.description,
    `Role: ${item.role} | Status: ${item.status} | ${formatRange(item.startDate, item.endDate)}`,
    `Technologies: ${item.technologies.join(', ')}`,
    bullets(item.highlights),
    bullets([...new Set([item.url, item.github, item.demo].filter((url): url is string => Boolean(url)))]
      .map(url => `[${url}](${url})`)),
  ].filter(Boolean).join('\n\n')).join('\n\n');
}

export function fullProfileMarkdown(site: URL): string {
  return [
    `# ${profile.contact.name}`, `> ${profile.contact.title}`,
    `Source: [Portfolio](${site.href})`,
    '## Summary', profile.summary,
    '## Experience', experienceMarkdown(),
    '## Education', educationMarkdown(),
    '## Skills', skillsMarkdown(),
    '## Projects', projectsMarkdown(),
    '## Contact', contactMarkdown(),
  ].join('\n\n') + '\n';
}

export async function markdownMirrors() {
  const posts = await getPosts();
  const overview = [
    `# ${profile.contact.name}`, `> ${profile.contact.title}`, profile.summary,
    '## Experience', experienceMarkdown(),
    '## Education', educationMarkdown(),
    '## Skills', skillsMarkdown(),
    '## Contact', contactMarkdown(),
  ].join('\n\n');
  return [
    { slug: 'index', path: '/', body: overview },
    { slug: 'about', path: '/about', body: overview },
    { slug: 'resume', path: '/resume', body: '' },
    { slug: 'projects', path: '/projects', body: `# Projects — ${profile.contact.name}\n\n${projectsMarkdown()}` },
    ...posts.map(post => ({
      slug: post.path.slice(1), path: post.path,
      body: `# ${post.title}\n\n> ${post.description}\n\n${post.body}`,
    })),
  ].filter(page => isIndexablePath(page.path));
}

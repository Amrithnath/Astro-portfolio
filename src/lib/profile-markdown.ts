import { formatRange } from './format-date';
import { contentPath, getProjectWriteups, getPublishedCollection } from './content';
import { absoluteProfileUrl, isIndexablePath, profile, profileLinks } from './seo';

export async function getPosts() {
  const blogs = await getPublishedCollection('blog');
  const projects = await getPublishedCollection('projects');
  const docs = [...blogs, ...projects];
  return Promise.all(docs.map(async entry => {
    const path = contentPath(entry);
    const isProject = entry.collection === 'projects';
    const relatedProject = !isProject && entry.data.project
      ? projects.find(project => project.id === entry.data.project?.id)
      : undefined;
    const writeups = isProject ? await getProjectWriteups(entry.id) : [];
    const tech = 'tech' in entry.data && entry.data.tech?.length ? entry.data.tech : entry.data.tags || [];
    const links = isProject ? [
      ['GitHub', entry.data.github], ['Live', entry.data.live], ['Demo', entry.data.demo], ['Project link', entry.data.link],
    ].filter((link): link is [string, string] => Boolean(link[1])) : [];
    const details = isProject ? [
      `Status: ${entry.data.status || 'Not specified'}`,
      tech.length ? `Technologies: ${tech.join(', ')}` : '',
      ...links.map(([label, url]) => `${label}: ${url}`),
      writeups.length ? `Write-ups:\n${writeups.map(post => `- [${post.data.title}](/blog/${post.id}/)`).join('\n')}` : 'Write-ups: None linked',
    ].filter(Boolean) : relatedProject ? [
      `Part of project: [${relatedProject.data.title}](/project/${relatedProject.id}/)`,
    ] : [];
    return {
      path,
      title: entry.data.title,
      description: entry.data.description,
      body: [details.join('\n\n'), entry.body?.trim() || ''].filter(Boolean).join('\n\n'),
    };
  })).then(posts => posts.filter(post => isIndexablePath(post.path)));
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

import type { APIRoute } from 'astro';
import { keyPages, getPosts } from '../lib/profile-markdown';
import { profile } from '../lib/seo';

export const prerender = true;
export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const link = (label: string, path: string, description: string) =>
    `- [${label}](${new URL(path, site).href}): ${description}`;
  const section = (heading: string, lines: string[]) => [heading, '', ...lines].join('\n');
  const body = [
    `# ${profile.contact.name}`,
    `> ${profile.contact.title}. ${profile.summary}`,
    'This is the public professional portfolio. HTML and Markdown are generated at build time; JavaScript is not required to read the profile. Canonical HTML links are provided in each Markdown mirror.',
    section('## Profile', keyPages.map(page => link(page.label, page.path, page.description))),
    section('## Markdown', [
      ...keyPages.filter(page => page.markdown).map(page => link(page.label, page.markdown!, page.description)),
      link('Full profile', '/llms-full.txt', 'Complete summary, experience, education, skills, projects, and contact links.'),
    ]),
    section('## Feeds', [link('RSS feed', '/rss.xml', 'Latest published blog posts.')]),
    section('## Writing and project notes', posts.flatMap(post => [
      link(post.title, `${post.path}/`, post.description),
      link(`${post.title} (Markdown)`, `${post.path}.md`, 'Plain Markdown version of the same content.'),
    ])),
  ].join('\n\n') + '\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

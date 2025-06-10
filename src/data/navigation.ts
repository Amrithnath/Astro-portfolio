import type { LsItem } from '../components/LsOutput.astro';

export const homeDirectoryItems: LsItem[] = [
  {
    name: '.',
    isDirectory: true,
    isAccessible: true,
    size: 224,
    date: 'Dec 16',
    time: '14:30'
  },
  {
    name: '..',
    isDirectory: true,
    isAccessible: true,
    size: 96,
    date: 'Dec 15',
    time: '09:15'
  },

  {
    name: '.ghostty',
    isDirectory: false,
    isAccessible: true,
    size: 128,
    date: 'Dec 16',
    time: '08:30'
  },
  {
    name: 'about/',
    isDirectory: true,
    isAccessible: true,
    size: 128,
    date: 'Dec 16',
    time: '14:25',
    href: '/about'
  },
  {
    name: 'blog/',
    isDirectory: true,
    isAccessible: true,
    size: 96,
    date: 'Dec 15',
    time: '16:20',
    href: '/blog'
  },
  {
    name: 'contact.txt',
    isDirectory: false,
    isAccessible: true,
    size: 892,
    date: 'Dec 16',
    time: '09:15',
    href: '/contact'
  },
  {
    name: 'projects/',
    isDirectory: true,
    isAccessible: true,
    size: 256,
    date: 'Dec 16',
    time: '13:45',
    href: '/projects'
  },
  {
    name: 'resume.pdf',
    isDirectory: false,
    isAccessible: true,
    size: 1247,
    date: 'Dec 16',
    time: '10:30',
    href: '/resume'
  }
];

export function getProjectItems(projects: any[]): LsItem[] {
  const baseItems: LsItem[] = [
    {
      name: '.',
      isDirectory: true,
      isAccessible: true,
      size: 256,
      date: 'Dec 16',
      time: '13:45'
    },
    {
      name: '..',
      isDirectory: true,
      isAccessible: true,
      size: 224,
      date: 'Dec 16',
      time: '14:30'
    }
  ];

  const projectItems: LsItem[] = projects.map((project, index) => ({
    name: project.url ? 
      `${project.frontmatter?.title?.toLowerCase().replace(/\s+/g, '-') || `project-${index + 1}`}/` :
      `.${project.frontmatter?.title?.toLowerCase().replace(/\s+/g, '-') || `project-${index + 1}`}/`,
    isDirectory: true,
    isAccessible: !!project.url,
    size: 128,
    date: `Dec ${15 - index}`,
    time: `1${index}:30`,
    href: project.url || undefined
  }));

  const futureItems: LsItem[] = [
    {
      name: '.future-ai-project/',
      isDirectory: true,
      isAccessible: false,
      size: 1024,
      date: 'Dec 14',
      time: '09:00'
    },
    {
      name: '.blockchain-app/',
      isDirectory: true,
      isAccessible: false,
      size: 512,
      date: 'Dec 13',
      time: '15:30'
    },
    {
      name: '.mobile-game/',
      isDirectory: true,
      isAccessible: false,
      size: 768,
      date: 'Dec 12',
      time: '11:45'
    }
  ];

  return [...baseItems, ...projectItems, ...futureItems];
} 
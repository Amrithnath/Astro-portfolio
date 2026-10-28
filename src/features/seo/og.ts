export const ogWidth = 1200;
export const ogHeight = 630;

export const ogPages: Record<string, string> = {
  '/': 'Portfolio',
  '/about': 'About',
  '/projects': 'Projects',
  '/contact': 'Contact',
  '/resume': 'Resume Generator',
  '/privacy-policy': 'Privacy Policy',
  '/privacy-check': 'Privacy Check',
};

export function ogImagePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return '/og/index.png';
  return path in ogPages || /^\/(blog|project)\/.+/.test(path)
    ? `/og${path}.png`
    : '/og/default.png';
}

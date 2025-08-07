export interface WipConfig {
  routes: Record<string, { title?: string; note?: string }>;
}

export const wipConfig: WipConfig = {
  // Add route paths you want to mark as WIP here
  routes: {
    // '/resume': { title: 'Resume WIP', note: 'Polishing up the generator.' },
    // '/projects': { title: 'Projects WIP', note: 'Updating recent work.' },
  },
};

export function isWip(pathname: string): false | { title?: string; note?: string } {
  return wipConfig.routes[pathname] || false;
}



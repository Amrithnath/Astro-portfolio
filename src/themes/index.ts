export interface Theme {
  id: string;
  label: string;
  colorScheme: 'dark' | 'light';
  themeColor: string;
}

export const themes = [
  { id: 'terminal', label: 'Terminal', colorScheme: 'dark', themeColor: '#1e1e2e' },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof themes)[number]['id'];
export const defaultTheme: ThemeId = 'terminal';

export interface ThemeAPI {
  readonly current: ThemeId;
  set(id: ThemeId): boolean;
}

declare global {
  interface Window {
    __theme: ThemeAPI;
  }
}

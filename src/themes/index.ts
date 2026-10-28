export interface Theme {
  id: string;
  label: string;
  colorScheme: 'dark' | 'light';
  themeColor: string;
}

export const themes = [
  { id: 'terminal', label: 'Terminal', colorScheme: 'dark', themeColor: '#1e1e2e' },
  { id: 'light', label: 'Light', colorScheme: 'light', themeColor: '#f5f2e9' },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof themes)[number]['id'];
export const defaultTheme: ThemeId = 'terminal';

export type ThemePreference = 'auto' | ThemeId;

export interface ThemeAPI {
  readonly current: ThemeId;
  readonly preference: ThemePreference;
  set(id: string): boolean;
  auto(): boolean;
}

declare global {
  interface Window {
    __theme: ThemeAPI;
  }
}

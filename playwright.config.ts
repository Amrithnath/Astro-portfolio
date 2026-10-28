import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 4321);
const baseURL = `http://127.0.0.1:${port}`;
// CI sets PLAYWRIGHT_CHANNEL=chrome to reuse the runner's preinstalled Chrome instead of
// downloading Chromium and its system dependencies on every run.
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{testFilePath}/{arg}{ext}',
  updateSnapshots: 'none',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
  },
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/visual.spec.ts',
      use: { ...devices['Desktop Chrome'], channel },
    },
    {
      name: 'visual-desktop',
      testMatch: '**/visual.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel,
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
        locale: 'en-US',
        timezoneId: 'UTC',
        serviceWorkers: 'block',
      },
    },
    {
      name: 'visual-mobile',
      testMatch: '**/visual.spec.ts',
      use: {
        ...devices['Pixel 7'],
        channel,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        locale: 'en-US',
        timezoneId: 'UTC',
        serviceWorkers: 'block',
      },
    },
  ],
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

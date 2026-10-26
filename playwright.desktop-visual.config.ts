import { defineConfig, devices } from '@playwright/test';

/**
 * Desktop pixel guard for the mobile work. Runs the visual spec against the
 * admin-panel-free dev server on 4175 (a client build never has the panel).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /desktop-visual\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  snapshotPathTemplate: '{testDir}/__snapshots__/desktop/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4175',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Phone-viewport audit and mobile regression projects.
 *
 * Separate from playwright.config.ts so the desktop suite keeps its single
 * Desktop Chrome project. Run against a dev server started WITHOUT the admin panel on 4175 (a client build never has it):
 *
 *   VITE_HORIZON_API_BASE_URL=http://127.0.0.1:9999 npx vite --port 4175 &
 *   npx playwright test -c playwright.audit.config.ts
 *
 * iPhone presets default to WebKit; set AUDIT_ENGINE=chromium to run them in
 * Chromium's mobile emulation when WebKit is not installed.
 */

const engine = process.env.AUDIT_ENGINE === 'chromium' ? 'chromium' : undefined;

const iphone = (name: string) => ({
  ...devices[name],
  ...(engine ? { browserName: engine as 'chromium', defaultBrowserType: engine } : {}),
});

export default defineConfig({
  testDir: './e2e/mobile',
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  outputDir: process.env.AUDIT_RESULTS ?? 'test-results/mobile',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-14', use: iphone('iPhone 14') },
    { name: 'iphone-14-landscape', use: iphone('iPhone 14 landscape') },
    { name: 'iphone-15', use: iphone('iPhone 15') },
    { name: 'iphone-15-landscape', use: iphone('iPhone 15 landscape') },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'pixel-7-landscape', use: { ...devices['Pixel 7 landscape'] } },
    {
      name: 'narrow-320',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
      },
    },
  ],
});

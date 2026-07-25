import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'VITE_HORIZON_ENABLE_ADMIN_PANEL=true VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID=workspace-123 VITE_HORIZON_API_BASE_URL=http://127.0.0.1:9999 npm run dev -- --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

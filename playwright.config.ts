import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,   // relay tests share a live DB — run sequentially
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Start vite preview before running tests (local only; CI builds first)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run preview',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 10_000,
      },
})

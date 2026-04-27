import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the HypnoSleep frontend.
 *
 * The tests are intentionally hermetic: they exercise the public landing
 * page only, so they never need Stripe keys, OAuth credentials, a database,
 * or the Express API. The Vite dev server is started automatically via the
 * `webServer` block below.
 */
const PORT = Number(process.env.E2E_PORT ?? 5173)
const HOST = process.env.E2E_HOST ?? '127.0.0.1'
const BASE_URL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})

import { defineConfig, devices } from '@playwright/test';

// Frontend E2E config. Assumes servers are already running locally.
// - Frontend: http://localhost:3000 (Next.js)
// - Backend:  http://localhost:4000 (Express)
// If not running, start them from repo root: `npm run dev`

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: isCI ? 40_000 : 30_000,
  expect: { timeout: isCI ? 10_000 : 5_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev:e2e',
      cwd: '../backend',
      port: 4000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        USE_MOCK_STRIPE: '1',
        JWT_SECRET: 'dev-secret',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: 'whsec_mock',
        PORT: '4000',
      },
    },
    {
      // Use production mode for local and CI to avoid React invalid-hook errors from dev HMR
      command: 'npm run build && npm run start -- -p 3000',
      cwd: '../frontend',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE: 'http://localhost:4000',
        NEXT_PUBLIC_DISABLE_PAYMENTS: '1',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

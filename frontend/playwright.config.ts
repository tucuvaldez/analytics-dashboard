import { defineConfig, devices } from '@playwright/test'

const API_PORT = 5001
const WEB_PORT = 5173

export default defineConfig({
  testDir: './e2e',
  // Tests share one database and one backend: run serially for deterministic output.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Only set in sandboxes that ship their own Chromium; normally `npx playwright install chromium` is enough.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Requires PostgreSQL running and `npx prisma migrate dev` already applied (see backend/README.md).
      command: 'npm run dev',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        // Every test signs up a fresh user, so lift the brute-force limits for the test run only.
        AUTH_RATE_LIMIT_MAX: '10000',
        RATE_LIMIT_MAX: '100000',
        BCRYPT_ROUNDS: '4',
      },
    },
    {
      command: 'npm run dev',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
})

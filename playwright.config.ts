import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 * Tests live in `e2e/` and run against a dedicated Next.js dev server on
 * port 3100 (separate from the default 3000 dev port, so E2E runs never
 * collide with a dev server you already have open). Playwright starts and
 * stops this server automatically via `webServer` below.
 */
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 * Tests live in `e2e/` and run against the Next.js dev server on port 3000.
 * Next 16 allows only one dev server per project, so we reuse an already
 * running `npm run dev` if present (reuseExistingServer) and otherwise start
 * one — rather than spawning a second server on a separate port.
 */
const PORT = 3000;
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
    // Next 16 permits only one dev server per project — reuse a running one.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

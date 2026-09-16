import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility checks.
 *
 * Kept separate from the vitest suite: those are fast pure-function tests that
 * run on every save, these need a real browser and a built app. Both run in CI.
 *
 * Targets the production build rather than the dev server, because the things
 * most likely to break accessibility — the CSP, static prerendering, the
 * pre-paint theme script — only behave like production in a production build.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Skipped when E2E_BASE_URL points at a deployed instance.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

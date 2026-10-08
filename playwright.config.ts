import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-engine E2E for Session Clock.
 *
 *   chromium / mobile-chrome  → Blink
 *   firefox                   → Gecko
 *   webkit / mobile-safari    → WebKit  (Playwright's WebKit build — close to
 *                               Safari, but NOT a real iPhone/Mac Safari)
 *
 * Target selection:
 *   - default: build + serve the PRODUCTION bundle locally (`vite preview`), so
 *     a PR is tested before it ever reaches Cloudflare Pages.
 *   - PLAYWRIGHT_TEST_BASE_URL=https://… : test an already-deployed site
 *     instead (no local build/server is started).
 */
const PORT = 4173;
const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  timeout: 30_000,
  expect: { timeout: 7_000 },

  fullyParallel: true,
  forbidOnly: isCI,
  // One retry in CI: enough to absorb a browser-start hiccup, low enough that
  // real intermittent bugs still show up as "flaky" in the report.
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,

  // CI: each matrix job writes a blob; the `report` job merges them into ONE
  // HTML report. Locally: a normal HTML report.
  reporter: isCI
    ? [["list"], ["github"], ["blob"]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // A clean, fixed environment makes failures reproducible across engines.
    locale: "en-US",
    timezoneId: "UTC",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // Touch + small-viewport coverage on the same three engines' families.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],

  webServer: externalBaseURL
    ? undefined
    : {
        // Build once, then serve dist/. `--strictPort` fails loudly instead of
        // silently moving to another port and testing the wrong thing.
        command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});

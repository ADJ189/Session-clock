import { defineConfig, devices } from "@playwright/test";
import { isCI, sharedUse, webServer } from "./playwright.shared";

/**
 * Cross-engine E2E for Session Clock.
 *
 *   desktop-chromium           → Blink, full primary regression suite
 *   desktop-firefox            → Gecko, @smoke compatibility subset
 *   desktop-webkit             → WebKit build (@smoke subset; not real Safari)
 *   mobile-chromium-emulation  → Pixel 7 profile, @mobile subset
 *   mobile-webkit-emulation    → iPhone 13 profile, @mobile subset
 *
 * Target selection:
 *   - default: build + serve the PRODUCTION bundle locally (`vite preview`), so
 *     a PR is tested before it ever reaches Cloudflare Pages.
 *   - PLAYWRIGHT_TEST_BASE_URL=https://… : test an already-deployed site
 *     instead (no local build/server is started).
 *
 * Tag policy follows the combined plan: `@smoke` for the small cross-browser
 * subset, `@mobile` for focused mobile-layout/flow coverage, and
 * `@mobile-only` for tests that must never run in the desktop Chromium gate.
 */
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
  // Two workers keeps a shared runner responsive; browser processes can
  // exhaust memory long before all CPU cores are busy.
  workers: 2,

  // CI: each matrix job writes a blob; the `report` job merges them into ONE
  // HTML report. Locally: a normal HTML report.
  reporter: isCI
    ? [["list"], ["github"], ["blob"]]
    : [["list"], ["html", { open: "never" }]],

  use: sharedUse,

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      // Primary gate: everything that is not explicitly mobile-only.
      grepInvert: /@mobile-only/,
    },
    {
      name: "desktop-firefox",
      use: { ...devices["Desktop Firefox"] },
      grep: /@smoke/,
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"] },
      grep: /@smoke/,
    },
    {
      name: "mobile-chromium-emulation",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
    },
    {
      name: "mobile-webkit-emulation",
      use: { ...devices["iPhone 13"] },
      grep: /@mobile/,
    },
  ],

  webServer,
});

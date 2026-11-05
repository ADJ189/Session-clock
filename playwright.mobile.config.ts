import { defineConfig, devices } from "@playwright/test";
import { isCI, sharedUse, webServer } from "./playwright.shared";

/**
 * Focused mobile-emulation job. Same server/use settings as the main config,
 * but only the two mobile projects and a single worker so emulation does not
 * spawn more browser processes than a small runner can hold.
 *
 * These are viewport/touch profiles, not physical-device certification.
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results/mobile",

  timeout: 45_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 2,

  reporter: isCI ? [["list"], ["github"]] : [["list"]],

  use: sharedUse,

  projects: [
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

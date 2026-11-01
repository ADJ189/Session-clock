// Shared Playwright settings for the main and mobile configs.
//
// Node/npm are not required in this workspace: every command in `deno.json`
// and in `webServer.command` runs the npm tools through `deno run -A npm:…`.
// Keeping the server/use block here stops the mobile config from drifting.

export const PORT = 4173;
export const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
export const baseURL = externalBaseURL || `http://127.0.0.1:${PORT}`;
export const isCI = !!process.env.CI;

export const sharedUse = {
  baseURL,
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  actionTimeout: 10_000,
  navigationTimeout: 30_000,
  // A clean, fixed environment makes failures reproducible across engines.
  locale: "en-US",
  timezoneId: "UTC",
} as const;

export const webServer = externalBaseURL
  ? undefined
  : {
      // Build once, then serve dist/. `--strictPort` fails loudly instead of
      // silently moving to another port and testing the wrong thing.
      command: `deno run -A npm:vite@6.4.4 build && deno run -A npm:vite@6.4.4 preview --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: baseURL,
      // Always run the build; an existing preview may serve stale output.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore" as const,
      stderr: "pipe" as const,
    };

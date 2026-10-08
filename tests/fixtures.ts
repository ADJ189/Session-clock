import { test as base, expect } from "@playwright/test";

/**
 * Shared fixtures.
 *
 * - Every request to a different origin (Google Fonts, weather/time/GitHub
 *   APIs, …) is aborted. Tests then depend only on our own bundle, never on
 *   third-party uptime, and "failed request" checks stay meaningful.
 * - `sc_onboarded_v2` is pre-seeded so the first-run onboarding modal doesn't
 *   sit on top of the UI. Opt out with `test.use({ firstRun: true })`.
 * - `problems` collects uncaught exceptions + same-origin failures for the
 *   whole test, so any spec can assert "nothing broke" at the end.
 */
type Fixtures = {
  firstRun: boolean;
  problems: {
    pageErrors: string[];
    failedRequests: string[];
    consoleErrors: string[];
  };
};

// Browser-generated noise from the aborted third-party requests above — not
// app bugs. (The production build strips the app's own console.* calls.)
const NETWORK_NOISE =
  /failed to load resource|net::err_|networkerror|load failed|blocked|fetch api cannot load|due to access control/i;

export const test = base.extend<Fixtures>({
  firstRun: [false, { option: true }],

  problems: async ({ page }, use, testInfo) => {
    const problems = {
      pageErrors: [] as string[],
      failedRequests: [] as string[],
      consoleErrors: [] as string[],
    };
    const baseURL = testInfo.project.use.baseURL ?? "";
    const origin = baseURL ? new URL(baseURL).origin : "";

    page.on("pageerror", (e) => problems.pageErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) {
        problems.consoleErrors.push(m.text());
      }
    });
    page.on("requestfailed", (r) => {
      if (origin && r.url().startsWith(origin)) {
        problems.failedRequests.push(
          `${r.method()} ${r.url()} :: ${r.failure()?.errorText ?? "unknown"}`,
        );
      }
    });
    await use(problems);
  },

  page: async ({ page, context, firstRun }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? "";
    const origin = baseURL ? new URL(baseURL).origin : "";

    await context.route(
      (url) => /^https?:$/.test(url.protocol) && url.origin !== origin,
      (route) => route.abort(),
    );

    if (!firstRun) {
      await page.addInitScript(() => {
        try {
          if (!localStorage.getItem("sc_onboarded_v2")) {
            localStorage.setItem("sc_onboarded_v2", "1");
          }
        } catch {
          /* storage blocked — the app has its own fallback */
        }
      });
    }
    await use(page);
  },
});

export { expect };

/** Waits until the app reports a successful boot and the splash is gone. */
export async function waitForBoot(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      (window as unknown as { __bootCompleted?: boolean }).__bootCompleted ===
      true,
    undefined,
    { timeout: 20_000 },
  );
  await expect(page.locator("#splashScreen")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator("#scBootErr")).toHaveCount(0);
  await expect(page.locator("#mainUI")).toBeVisible();
}

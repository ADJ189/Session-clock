import { test, expect, waitForBoot, closeThemePanel } from "./fixtures";

test.describe.configure({ mode: "serial" });
// A service worker can serve assets from its cache, which bypasses page.route.
// These tests deliberately simulate network/import failures, so block workers
// for the spec and test registration failure explicitly below.
test.use({ serviceWorkers: "block" });

/**
 * Subsystem-boundary resilience from the combined plan:
 *
 *   - canvas context missing or lost â†’ static fallback, clock/timer continue
 *   - a draw exception is recorded once and the renderer is not re-entered
 *   - AudioContext constructor failure â†’ disabled audio controls, no page error
 *   - optional dynamic import failure â†’ recoverable toast, app continues
 *   - service-worker registration failure â†’ app still boots online
 *   - reduced motion is honoured
 *
 * Every test shows the seconds readout so "the clock still updates" is a real
 * assertion, not just "some digits exist".
 */

type Problems = {
  pageErrors: string[];
  failedRequests: string[];
  consoleErrors: string[];
};

async function showSeconds(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("sc_hide_seconds", "0");
    localStorage.setItem("sc_hide_ms", "1");
  });
}

async function expectCoreUsable(
  page: import("@playwright/test").Page,
  problems: Problems,
) {
  await closeThemePanel(page);
  await expect(page.locator("#digitHr")).toHaveText(/^\d{1,2}$/);
  await expect(page.locator("#digitMin")).toHaveText(/^\d{2}$/);

  const seconds = page.locator("#digitSec");
  await expect(seconds).toBeVisible();
  const before = await seconds.textContent();
  await expect
    .poll(() => seconds.textContent(), { timeout: 5_000 })
    .not.toBe(before);

  const start = page.locator("#btnStart");
  await start.click();
  await expect(page.locator("body")).toHaveClass(/session-running/);
  await start.click();
  await expect(page.locator("body")).not.toHaveClass(/session-running/);

  expect(problems.pageErrors).toEqual([]);
}

/** Force selected canvas ids to return a null 2D context before app boot. */
async function nullCanvas(
  page: import("@playwright/test").Page,
  ids: string[],
) {
  await page.addInitScript((blocked: string[]) => {
    const proto = HTMLCanvasElement.prototype;
    const original = proto.getContext as unknown as (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) => RenderingContext | null;
    proto.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      options?: unknown,
    ) {
      if (blocked.includes(this.id)) return null;
      return original.call(this, id, options);
    } as unknown as typeof proto.getContext;
  }, ids);
}

test.describe("renderer resilience", () => {
  test("core boot survives a missing background canvas @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await nullCanvas(page, ["bgCanvas"]);
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("body")).toHaveClass(/renderer-fallback/);
    await expectCoreUsable(page, problems);
  });

  test("a missing transition canvas degrades transitions only @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await nullCanvas(page, ["transCanvas"]);
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("body")).not.toHaveClass(/renderer-fallback/);
    await expectCoreUsable(page, problems);
  });

  test("a draw exception is recorded once and never re-entered @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await page.addInitScript(() => {
      const state = window as unknown as { __scBgSaveCalls: number };
      state.__scBgSaveCalls = 0;
      const proto = CanvasRenderingContext2D.prototype;
      const original = proto.save;
      proto.save = function (this: CanvasRenderingContext2D) {
        if (this.canvas?.id === "bgCanvas") {
          state.__scBgSaveCalls++;
          throw new Error("forced draw failure");
        }
        return original.call(this);
      };
    });
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("body")).toHaveClass(/renderer-fallback/);
    const calls = () =>
      page.evaluate(
        () =>
          (window as unknown as { __scBgSaveCalls: number }).__scBgSaveCalls,
      );
    await expect.poll(calls).toBe(1);
    await page.waitForTimeout(1_200);
    expect(await calls(), "renderer must not be re-entered every frame").toBe(
      1,
    );

    // The failure handler imports diagnostics lazily; wait for the single event.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as { __scDiagnosticsText?: () => string }
              ).__scDiagnosticsText?.() ?? "",
          ),
        { timeout: 5_000 },
      )
      .toContain("Renderer background disabled: draw-error");
    const text = await page.evaluate(
      () =>
        (window as unknown as { __scDiagnosticsText?: () => string }).__scDiagnosticsText?.() ??
        "",
    );
    expect(text.match(/Renderer background disabled: draw-error/g)).toHaveLength(
      1,
    );

    await expectCoreUsable(page, problems);
  });

  test("a lost canvas context falls back and a restore resumes drawing", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await page.goto("/");
    await waitForBoot(page);

    await page.evaluate(() => {
      document
        .getElementById("bgCanvas")!
        .dispatchEvent(new Event("contextlost", { cancelable: true }));
    });
    await expect(page.locator("body")).toHaveClass(/renderer-fallback/);

    await page.evaluate(() => {
      document.getElementById("bgCanvas")!.dispatchEvent(new Event("contextrestored"));
    });
    await expect(page.locator("body")).not.toHaveClass(/renderer-fallback/);
    await expectCoreUsable(page, problems);
  });
});

test.describe("audio and optional-subsystem resilience", () => {
  test("AudioContext constructor failure disables audio but not the clock @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await page.addInitScript(() => {
      class BlockedAudioContext {
        constructor() {
          throw new Error("AudioContext blocked for test");
        }
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: BlockedAudioContext,
      });
      Object.defineProperty(window, "webkitAudioContext", {
        configurable: true,
        value: BlockedAudioContext,
      });
    });
    await page.goto("/");
    await waitForBoot(page);

    // The first pointer gesture tries to unlock audio; it must swallow the
    // constructor failure. Reopening the mixer then shows the unavailable
    // state instead of throwing from a click handler.
    await page.locator("#btnSound").click();
    await expect(page.locator("#soundOverlay")).toHaveClass(/open/);
    await expect(
      page.locator("#soundOverlay .track-unavailable").first(),
    ).toBeVisible();
    await expect(
      page.locator("#soundOverlay .track-toggle").first(),
    ).toBeDisabled();

    await page.evaluate(() => {
      (window as unknown as { SC?: { modals?: { close?: (id: string) => void } } }).SC?.modals?.close?.("soundOverlay");
    });
    await expectCoreUsable(page, problems);
  });

  test("an optional dynamic import failure is recoverable @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    // The legal text is intentionally a lazy chunk; aborting it must produce
    // the user-facing retry toast, not an uncaught rejection.
    await page.route("**/*legal*.js", (route) => route.abort());
    await page.goto("/");
    await waitForBoot(page);

    await page.locator("#btnSettings").click();
    await page.locator('.settings-tab-btn[data-tab="privacy"]').click();
    await page.getByRole("button", { name: /Privacy Policy/i }).click();
    await expect(
      page.locator(".sc-toast-text", {
        hasText: "Couldn't load this page",
      }),
    ).toBeVisible();
    await expect(page.locator("#legalOverlay")).not.toHaveClass(/open/);

    await page.evaluate(() => {
      (window as unknown as { SC?: { modals?: { close?: (id: string) => void } } }).SC?.modals?.close?.("settingsOverlay");
    });
    await expectCoreUsable(page, problems);
  });

  test("service-worker registration failure leaves the app usable @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    // Make the failure explicit rather than relying on the harness: the app's
    // registerSW() path must catch this rejection and keep the UI usable.
    await page.addInitScript(() => {
      const sw = navigator.serviceWorker;
      if (!sw) return;
      try {
        Object.defineProperty(sw, "register", {
          configurable: true,
          value: () =>
            Promise.reject(new Error("registration blocked for test")),
        });
      } catch {
        // If the property is locked, the harness's service-worker block still
        // covers the same failure mode.
      }
    });
    await page.goto("/");
    await waitForBoot(page);

    expect(
      await page.evaluate(() =>
        navigator.serviceWorker
          ? navigator.serviceWorker.getRegistrations().then((r) => r.length)
          : 0,
      ),
    ).toBe(0);
    await expectCoreUsable(page, problems);
  });

  test("reduced motion is honoured without breaking the clock @smoke @cross-browser @mobile", async ({
    page,
    problems,
  }) => {
    await showSeconds(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForBoot(page);

    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    await page.locator("#topbarThemesBtn").click();
    await expect(page.locator("#themeLibOverlay")).toHaveClass(/open/);
    const duration = await page
      .locator(".tl-card")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    // Some engines serialise a 0.01ms reduced-motion duration as `1e-05s`.
    // What matters is that it is effectively instant, not the spelling.
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.02);
    await page.keyboard.press("Escape");
    await expect(page.locator("#themeLibOverlay")).not.toHaveClass(/open/);

    await expectCoreUsable(page, problems);
  });
});

import { test, expect, waitForBoot } from "./fixtures";

// These tests drive a full-screen dialog with a backdrop blur and a spring
// entrance. On software-rendered WebKit (CI) those frames are slow enough that
// Playwright's "stable" actionability check can spend its whole 10s budget
// waiting for the entrance to finish. The app already honours
// prefers-reduced-motion for this dialog, so emulate it here: the tests are
// about behaviour (filtering, favourites, focus), not about the animation.
//
// The dialog also renders 103 preview cards, which is the heaviest screen in
// the app. On a loaded CI runner (two WebKit workers on a shared box) first
// paint can still take 15–20s even with the entrance disabled, so the default
// 10s action timeout fires before Playwright ever sees a stable frame. Give
// these behaviour assertions real headroom rather than turning CPU contention
// into a false failure.
test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: "reduce", actionTimeout: 20_000 });

type PwPage = import("@playwright/test").Page;

/**
 * Resolves once every *finite* animation/transition on the overlay and its
 * descendants has finished. Infinite ones (e.g. the "live" pulse dot) are
 * ignored — they never finish and don't move anything we click. Paused or
 * otherwise stuck finite animations are capped at 1.5 seconds.
 */
const settled = (page: PwPage, selector: string) =>
  page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return;
    const pending = document
      .getAnimations()
      .filter((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target;
        if (!(t instanceof Element) || !(t === root || root.contains(t))) return false;
        const end = a.effect?.getComputedTiming().endTime;
        return typeof end === "number" && Number.isFinite(end);
      })
      .map((a) => a.finished.catch(() => undefined));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all(pending),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, 1500); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, selector);

const open = async (page: PwPage) => {
  await page.goto("/");
  await waitForBoot(page);
  await page.locator("#topbarThemesBtn").click();
  await expect(page.locator("#themeLibOverlay")).toHaveClass(/open/);
  await settled(page, "#themeLibOverlay");
};

test.describe("theme library", () => {
  test("opens from the Themes button and lists every theme and category @smoke", async ({ page }) => {
    await open(page);
    await expect(page.locator(".tl-card")).toHaveCount(103);
    await expect(page.locator("#tlCount")).toHaveText("103 themes");
    for (const label of ["Natural", "TV Shows", "Movies", "Animation", "Anime", "F1 Teams"]) {
      await expect(page.locator(".tl-nav-item", { hasText: label })).toBeVisible();
    }
    await expect(page.locator(".tl-card.active")).toHaveCount(1);
    await expect(page.locator(".tl-card.active .tl-using")).toBeVisible();
  });

  test("keeps one header, one nav, one catalogue and a compact current strip", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sc_last_theme", "ocean");
      localStorage.setItem("sc_theme_recent_v1", '["ocean","severance"]');
    });
    await open(page);

    // One editorial header and one collection nav. The redesign removed the
    // duplicate spotlight/featured shelves that used to repeat the catalogue.
    await expect(page.locator("#themeLibOverlay h2")).toHaveCount(1);
    await expect(page.locator("#themeLibTitle")).toHaveText("Theme Finder");
    await expect(page.locator("#themeLibOverlay nav")).toHaveCount(1);
    await expect(page.locator("#tlGrid")).toHaveCount(1);
    await expect(page.locator("#themeLibOverlay .tl-card")).toHaveCount(103);
    await expect(page.locator("#tlGrid .tl-card")).toHaveCount(103);

    // The current-theme strip is compact and names the applied theme.
    const strip = page.locator("#tlSpotlight");
    await expect(strip).toBeVisible();
    await expect(strip.locator(".tl-current-name")).toHaveText("Ocean");
    const stripBox = (await strip.boundingBox())!;
    expect(stripBox.height).toBeLessThan(stripBox.width / 2);

    // Recents form a rail, and it disappears as soon as a query filters the
    // catalogue so the grid stays a single, uninterrupted result set.
    await expect(page.locator("#tlRecentSection")).toBeVisible();
    await expect(page.locator(".tl-recent-card")).toHaveCount(2);
    expect(
      await page.locator("#tlRecentRail").evaluate((el) => getComputedStyle(el).display),
    ).not.toBe("grid");
    await page.locator("#tlSearch").fill("ocean");
    await expect(page.locator("#tlRecentSection")).toBeHidden();
    await page.locator("#tlClear").click();
    await expect(page.locator("#tlRecentSection")).toBeVisible();

    // Every card carries a designed CSS scene, with a generated thumbnail
    // layered on top when one exists — never an empty tile.
    await expect(page.locator(".tl-card .tl-scene")).toHaveCount(103);
  });

  test("search filters by name and metadata, and shows a clearable empty state", async ({ page }) => {
    await open(page);
    await page.locator("#tlSearch").fill("robot");
    await expect(page.locator(".tl-card")).toHaveCount(1);
    await expect(page.locator("#tlCount")).toContainText("1 of 103");

    await page.locator("#tlSearch").fill("zzzzqqq");
    await expect(page.locator(".tl-card")).toHaveCount(0);
    await expect(page.locator(".tl-empty-title")).toHaveText("No themes found");
    await page.locator(".tl-empty-btn", { hasText: "Clear search" }).click();
    await expect(page.locator("#tlSearch")).toHaveValue("");
    await expect(page.locator(".tl-card")).toHaveCount(103);
  });

  test("category filter keeps the query and the active theme", async ({ page }) => {
    await open(page);
    const active = await page.locator(".tl-card.active").getAttribute("data-id");
    await page.locator('.tl-nav-item[data-view="anime"]').click();
    await expect(page.locator(".tl-card")).toHaveCount(11);
    await page.locator("#tlSearch").fill("akira");
    await expect(page.locator(".tl-card")).toHaveCount(1);
    await page.locator('.tl-nav-item[data-view="movie"]').click();
    await expect(page.locator("#tlSearch")).toHaveValue("akira");
    await expect(page.locator(".tl-card")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("sc_last_theme"))).toBe(active);
  });

  test("favourites persist across reload without applying the theme", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => localStorage.getItem("sc_last_theme"));
    const card = page.locator(".tl-card", { hasText: "Ocean" }).first();
    await card.locator(".tl-fav").click();
    await expect(card.locator(".tl-fav")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("sc_last_theme"))).toBe(before);

    await page.reload();
    await waitForBoot(page);
    await page.locator("#topbarThemesBtn").click();
    await page.locator('.tl-nav-item[data-view="favs"]').click();
    await expect(page.locator(".tl-card")).toHaveCount(1);
    await expect(page.locator(".tl-card .tl-name")).toHaveText("Ocean");
  });

  test("choosing a card applies the theme, records it as recent, and persists", async ({ page }) => {
    await open(page);
    await page.locator("#tlSearch").fill("severance");
    await page.locator(".tl-pick").first().click();
    // applyTheme finishes after the theme's own intro transition.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("sc_last_theme")), { timeout: 12_000 })
      .toBe("severance");
    await expect(page.locator(".tl-card.active")).toHaveAttribute("data-id", "severance");
    await page.locator('.tl-nav-item[data-view="recent"]').click();
    await expect(page.locator(".tl-card").first()).toHaveAttribute("data-id", "severance");
  });

  test("ignores malformed, unknown and duplicate saved ids", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sc_theme_favs_v1", "{not json");
      localStorage.setItem("sc_theme_recent_v1", '["ghost","constructor","toString","__proto__","severance",5,"severance"]');
    });
    await open(page);
    await page.locator('.tl-nav-item[data-view="recent"]').click();
    // The theme applied at boot is also a recent, so expect it plus severance,
    // each once; "ghost" and the non-string entry are dropped.
    const ids = await page.locator(".tl-card").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
    expect(ids).toContain("severance");
    expect(new Set(ids).size).toBe(ids.length);
    for (const invalid of ["ghost", "constructor", "toString", "__proto__"])
      expect(ids).not.toContain(invalid);
    await page.locator('.tl-nav-item[data-view="favs"]').click();
    await expect(page.locator(".tl-empty-title")).toHaveText("No favourites yet");
  });

  test("Escape closes it and returns focus; Ctrl+K still opens only the palette", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#themeLibOverlay")).not.toHaveClass(/open/);
    // `.open` is removed immediately, but the overlay only turns
    // visibility:hidden after its fade. WebKit blurs whatever was focused
    // inside it at that moment, so wait for it to be fully gone before moving
    // focus to the palette — otherwise the two race.
    await expect(page.locator("#themeLibOverlay")).toBeHidden();
    await page.keyboard.press("Control+k");
    await expect(page.locator("#cmdOverlay")).toHaveClass(/open/);
    await expect(page.locator("#cmdInput")).toBeFocused();
    await expect(page.locator("#themeLibOverlay")).not.toHaveClass(/open/);
  });

  test("the library is usable and does not overflow on a phone @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    const box = await page.locator(".tl-fav").first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#tlSearch")).toBeVisible();
  });

  for (const { label, width, height } of [
    { label: "phone", width: 390, height: 844 },
    { label: "320px", width: 320, height: 568 },
  ]) {
    test(`close, favourite and collection targets stay 44px at ${label} @mobile`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await open(page);

      for (const selector of [
        "#themeLibOverlay .tl-close",
        ".tl-card .tl-fav",
        ".tl-nav-item",
      ]) {
        const target = await page.locator(selector).first().boundingBox();
        expect(target, selector).not.toBeNull();
        expect(target!.width, `${selector} width`).toBeGreaterThanOrEqual(44);
        expect(target!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        "no horizontal overflow",
      ).toBeLessThanOrEqual(0);
    });
  }

  test("clearing the search keeps focus in the search field", async ({ page }) => {
    await open(page);
    await page.locator("#tlSearch").fill("robot");
    await expect(page.locator("#tlClear")).toBeVisible();
    await page.locator("#tlClear").click();
    await expect(page.locator("#tlSearch")).toHaveValue("");
    await expect(page.locator("#tlSearch")).toBeFocused();
    await expect(page.locator(".tl-card")).toHaveCount(103);
  });

  test("search and clear reuse the cached card nodes", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>(".tl-card")
        .forEach((card) => (card.dataset.scTestMark = "1"));
    });

    await page.locator("#tlSearch").fill("robot");
    await expect(page.locator(".tl-card")).toHaveCount(1);
    await page.locator("#tlClear").click();
    await expect(page.locator(".tl-card")).toHaveCount(103);

    // A rebuilt gallery would have fresh nodes with no marker.
    await expect(page.locator('.tl-card[data-sc-test-mark="1"]')).toHaveCount(
      103,
    );
  });

  for (const { label, width, height } of [
    { label: "desktop", width: 1280, height: 800 },
    { label: "390px mobile", width: 390, height: 844 },
  ]) {
    test(`first open paints the catalogue within budget on ${label}`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.skip(
        browserName !== "chromium",
        "CDP CPU throttling is Chromium-only",
      );
      await page.setViewportSize({ width, height });
      const cdp = await page.context().newCDPSession(page);
      // 4x slowdown approximates a mid-range phone / loaded CI box. This is a
      // measurement guard, not a micro-benchmark: it fails only if first open
      // regresses into multi-second territory.
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto("/");
      await waitForBoot(page);

      const elapsed = await page.evaluate(async () => {
        const start = performance.now();
        document.getElementById("topbarThemesBtn")!.click();
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (document.querySelectorAll("#tlGrid .tl-card").length === 103) {
              requestAnimationFrame(() => resolve());
              return;
            }
            setTimeout(tick, 16);
          };
          tick();
        });
        return performance.now() - start;
      });

      testInfo.annotations.push({
        type: "theme-finder-first-open",
        description: `${label}: ${elapsed.toFixed(0)}ms (4x CPU throttle)`,
      });
      expect(elapsed).toBeLessThan(8000);
      await expect(page.locator(".tl-card")).toHaveCount(103);
    });
  }
});

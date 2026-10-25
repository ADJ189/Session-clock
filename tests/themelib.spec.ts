import { test, expect, waitForBoot } from "./fixtures";

// These tests drive a full-screen dialog with a backdrop blur and a spring
// entrance. On software-rendered WebKit (CI) those frames are slow enough that
// Playwright's "stable" actionability check can spend its whole 10s budget
// waiting for the entrance to finish. The app already honours
// prefers-reduced-motion for this dialog, so emulate it here: the tests are
// about behaviour (filtering, favourites, focus), not about the animation.
test.use({ reducedMotion: "reduce" });

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
  test("opens from the Themes button and lists every theme and category", async ({ page }) => {
    await open(page);
    await expect(page.locator(".tl-card")).toHaveCount(103);
    await expect(page.locator("#tlCount")).toHaveText("103 themes");
    for (const label of ["Natural", "TV Shows", "Movies", "Animation", "Anime", "F1 Teams"]) {
      await expect(page.locator(".tl-nav-item", { hasText: label })).toBeVisible();
    }
    await expect(page.locator(".tl-card.active")).toHaveCount(1);
    await expect(page.locator(".tl-card.active .tl-using")).toBeVisible();
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

  test("the library is usable and does not overflow on a phone", async ({ page }) => {
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
});

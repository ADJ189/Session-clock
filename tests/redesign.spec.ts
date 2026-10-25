import { test, expect, waitForBoot, closeThemePanel } from "./fixtures";

/** WCAG relative luminance of an `rgb()`/`rgba()` string. */
function relativeLuminance(value: string): number {
  const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [r = 0, g = 0, b = 0] = channels.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `rgb()`/`rgba()` strings. */
function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

/**
 * Coverage for the Session Clock 2.0 redesign pass:
 *  - no in-app PWA install control, native install left to the browser
 *  - calm HH:MM clock defaults that never overwrite explicit settings
 *  - Center mode's right-hand session panel fits and stays legible
 *  - contextual top-bar tab replaces the old UTC/network-sync claim
 *  - the music deck is opt-in and absent on a clean profile
 *  - first-run welcome is content-led, accessible, and localizable
 */

test.describe("PWA install affordance", () => {
  test("no in-app install button, manifest still present", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("#pwaInstallBtn")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /install (app|session clock)/i }),
    ).toHaveCount(0);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });
});

test.describe("clock defaults and saved preferences", () => {
  test("a fresh profile gets a calm HH:MM clock", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("#digitHr")).toBeVisible();
    await expect(page.locator("#digitMin")).toBeVisible();
    await expect(page.locator("#digitSec")).toBeHidden();
    await expect(page.locator("#secMs")).toBeHidden();
  });

  test("an explicit seconds/milliseconds preference wins", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sc_hide_seconds", "0");
      localStorage.setItem("sc_hide_ms", "0");
    });
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("#digitSec")).toBeVisible();
    await expect(page.locator("#secMs")).toBeVisible();
  });

  test("every clock style renders with the calm HH:MM default", async ({
    page,
  }) => {
    const modes = [
      { mode: "digital", selector: ".clock-row" },
      { mode: "flip", selector: "#flipClockWrap" },
      { mode: "segment", selector: "#segmentClock" },
      { mode: "analogue", selector: "#analogueClock" },
      { mode: "minimal", selector: "#minimalClockWrap" },
      { mode: "word", selector: "#wordClockGrid" },
    ];

    await page.goto("/");
    await waitForBoot(page);

    for (const { mode, selector } of modes) {
      await page.evaluate((value) => {
        localStorage.setItem("sc_clock_mode", value);
      }, mode);
      await page.reload();
      await waitForBoot(page);
      await expect(page.locator(selector), `${mode} clock`).toBeVisible();
    }
  });
});

test.describe("contextual top-bar tab", () => {
  test("shows local app state, not a network time claim", async ({ page }) => {
    const timeRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url().toLowerCase();
      if (
        /worldtimeapi|timeapi\.io|worldclockapi|ntp\.|time\.google|time\.cloudflare/.test(
          url,
        )
      ) {
        timeRequests.push(url);
      }
    });

    await page.goto("/");
    await waitForBoot(page);

    const pill = page.locator("#contextPill");
    await expect(pill).toBeVisible();
    await expect(pill).not.toHaveText(/utc|sync/i);
    expect(timeRequests).toEqual([]);
  });

  test("top-bar controls fit without overlapping on narrow screens", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await waitForBoot(page);

    // Desktop projects exercise the responsive breakpoints explicitly; the
    // mobile projects keep their emulated device viewport.
    const sizes = isMobile
      ? [[0, 0]]
      : [
          [320, 568],
          [360, 740],
          [390, 844],
          [430, 932],
          [520, 800],
          [600, 800],
          [768, 1024],
          [1024, 768],
          [1440, 900],
        ];

    for (const [width, height] of sizes) {
      if (width) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(120);
      }

      const report = await page.evaluate(() => {
        const visible = (el: Element) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.width > 1 &&
            box.height > 1
          );
        };
        const items = [
          ...document.querySelectorAll<
            HTMLElement
          >(".topbar-left > *, .topbar-right > *"),
        ]
          .filter(visible)
          .map((el) => {
            const box = el.getBoundingClientRect();
            return {
              name: el.id || el.className,
              x: box.x,
              right: box.x + box.width,
              y: box.y,
              bottom: box.y + box.height,
            };
          });

        const overlaps: string[] = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];
            const overlapX =
              Math.min(a.right, b.right) - Math.max(a.x, b.x);
            const overlapY =
              Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
            if (overlapX > 0.5 && overlapY > 0.5) {
              overlaps.push(`${a.name} ↔ ${b.name}`);
            }
          }
        }
        return { items, overlaps, width: innerWidth };
      });

      expect(report.overlaps, `${report.width}px: overlapping header items`).toEqual(
        [],
      );
      for (const item of report.items) {
        expect(item.x, `${item.name} starts inside viewport`).toBeGreaterThanOrEqual(
          -1,
        );
        expect(
          item.right,
          `${item.name} ends inside viewport`,
        ).toBeLessThanOrEqual(report.width + 1);
      }
      await expect(page.locator("#contextPill")).toBeVisible();
      await expect(page.locator("#weatherPill")).toBeVisible();
    }
  });
});

test.describe("music deck opt-in", () => {
  test("is absent on a clean profile", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator(".sc-music-dock")).toHaveCount(0);
    const enabled = await page.evaluate(() =>
      localStorage.getItem("sc_music_deck"),
    );
    expect(enabled).not.toBe("1");
  });

  test("enables YouTube-first and only reveals Spotify when selected", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForBoot(page);

    // Explicit opt-in with no provider choice yet: YouTube is the default and
    // no Spotify connect prompt or network request should exist.
    await page.evaluate(() => localStorage.setItem("sc_music_deck", "1"));
    await page.reload();
    await waitForBoot(page);

    const dock = page.locator(".sc-music-dock");
    await expect(dock).toHaveCount(1);
    await expect(dock.locator('[data-role="tab-youtube"]')).toBeVisible();
    await expect(dock.locator('[data-role="tab-spotify"]')).toHaveCount(0);
    await expect(page.locator('[data-role="spotify-connect"]')).toHaveCount(0);

    // Choosing Spotify is an explicit, separate preference. The provider
    // preference alone remounts the dock; it must not force the Spotify tab
    // to become active or auto-load the SDK.
    await page.evaluate(() =>
      localStorage.setItem("sc_music_providers", "spotify"),
    );
    await page.reload();
    await waitForBoot(page);

    await expect(dock.locator('[data-role="tab-spotify"]')).toHaveClass(
      /active/,
    );
    await expect(dock.locator('[data-role="tab-youtube"]')).toHaveCount(0);
    await expect(
      dock.locator('[data-role="spotify-connect"]'),
    ).toBeVisible();
  });
});

test.describe("platform capability controls", () => {
  test("Haptic Feedback appears only where vibration is usable", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await waitForBoot(page);
    await closeThemePanel(page);

    await page.locator("#btnSettings").click();
    await page.locator('.settings-tab-btn[data-tab="display"]').click();

    // Desktop Chromium exposes navigator.vibrate as a no-op; only an actual
    // Android device family should offer the switch. mobile-chrome runs the
    // Pixel 7 profile, so it is the sole project where the row belongs.
    const row = page.getByText("Haptic Feedback", { exact: true });
    if (testInfo.project.name === "mobile-chrome") {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  });
});

test.describe("Center mode session panel", () => {
  const cases = [
    { name: "wide desktop", width: 1917, height: 915 },
    { name: "desktop", width: 1440, height: 900 },
    { name: "short laptop", width: 1440, height: 600 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "phone", width: 390, height: 844 },
    { name: "small phone", width: 320, height: 568 },
  ];

  for (const viewport of cases) {
    test(`fits, stays legible, and does not clip at ${viewport.name}`, async ({
      page,
      isMobile,
    }, testInfo) => {
      // Mobile projects run at their real device size; desktop projects are
      // resized explicitly. This mirrors ui.spec.ts's overflow coverage.
      test.skip(
        isMobile && viewport.name !== "phone",
        "mobile projects use their own device viewport",
      );
      if (!isMobile) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
      }

      await page.addInitScript(() => {
        localStorage.setItem(
          "sc_clock_pos_map",
          JSON.stringify({ digital: "center" }),
        );
        localStorage.setItem("sc_center_minimal", "1");
      });

      await page.goto("/");
      await waitForBoot(page);
      await closeThemePanel(page);

      await expect(page.locator("body")).toHaveClass(/clock-center/);
      await expect(page.locator("body")).toHaveClass(/center-minimal/);

      const card = page.locator(".session-card");
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;

      const vp = page.viewportSize()!;
      // Matches the CSS breakpoint: wide screens use the right-hand sidebar;
      // portrait tablets and phones use the bottom-right card.
      if (vp.width > 1024) {
        // Right-hand compact panel, never a full-width card.
        expect(box.x).toBeGreaterThan(vp.width * 0.6);
        expect(box.width).toBeLessThanOrEqual(260);
      } else {
        // Narrow screens: bottom-right card that stays inside the viewport.
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      }
      expect(box.height).toBeLessThanOrEqual(360);

      const timer = page.locator("#sessionTimer");
      await expect(timer).toBeVisible();
      const fontSize = await timer.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(18);

      // The HH:MM digits must fit their row; a too-large minimum font size
      // used to push the glowing digits past both edges at 320px.
      const rowFits = await page
        .locator(".clock-row")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(rowFits, "clock digits fit inside their row").toBe(true);
      const clock = await page.locator("#clock-block-wrap").boundingBox();
      expect(clock).not.toBeNull();
      if (clock) {
        expect(clock.x).toBeGreaterThanOrEqual(-1);
        expect(clock.x + clock.width).toBeLessThanOrEqual(vp.width + 1);
      }

      for (const selector of ["#btnStart", "#btnReset", "#btnPomToggle"]) {
        const control = page.locator(selector);
        await expect(control).toBeVisible();
        const cbox = await control.boundingBox();
        expect(cbox).not.toBeNull();
        if (!cbox) continue;
        expect(cbox.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(cbox.x + cbox.width).toBeLessThanOrEqual(box.x + box.width + 1);
        expect(cbox.y).toBeGreaterThanOrEqual(box.y - 1);
        expect(cbox.y + cbox.height).toBeLessThanOrEqual(
          box.y + box.height + 1,
        );
        // A flex box's scrollWidth can exceed clientWidth by a rounding
        // pixel even when nothing is visually cut. Compare the rendered
        // content range against the button's inner (padding) box instead.
        const clipped = await control.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const content = range.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const innerLeft =
            box.left +
            parseFloat(style.paddingLeft) +
            parseFloat(style.borderLeftWidth);
          const innerRight =
            box.right -
            parseFloat(style.paddingRight) -
            parseFloat(style.borderRightWidth);
          return (
            content.left < innerLeft - 0.5 || content.right > innerRight + 0.5
          );
        });
        expect(clipped, `${selector} label is not clipped`).toBe(false);
      }

      // The clock itself must remain the focal point, not be covered.
      if (vp.width > 1024) {
        if (clock) {
          const overlaps =
            clock.x < box.x + box.width &&
            clock.x + clock.width > box.x &&
            clock.y < box.y + box.height &&
            clock.y + clock.height > box.y;
          expect(overlaps).toBe(false);
        }
      }

      await page.screenshot({
        path: testInfo.outputPath(
          `center-${viewport.name.replaceAll(" ", "-")}.png`,
        ),
        fullPage: false,
      });
    });
  }
});

test.describe("Top mode session panel", () => {
  test("stays in flow, readable, and clear of the clock", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await waitForBoot(page);
    await closeThemePanel(page);

    await expect(page.locator("body")).not.toHaveClass(/clock-center/);
    const card = page.locator(".session-card");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);

    const clock = await page.locator("#clock-block-wrap").boundingBox();
    expect(clock).not.toBeNull();
    if (clock) {
      const overlaps =
        clock.x < box.x + box.width &&
        clock.x + clock.width > box.x &&
        clock.y < box.y + box.height &&
        clock.y + clock.height > box.y;
      expect(overlaps).toBe(false);
    }

    const timer = page.locator("#sessionTimer");
    await expect(timer).toBeVisible();
    const fontSize = await timer.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);

    for (const selector of ["#btnStart", "#btnReset", "#btnPomToggle"]) {
      const control = page.locator(selector);
      await expect(control).toBeVisible();
      const cbox = await control.boundingBox();
      expect(cbox).not.toBeNull();
      if (!cbox) continue;
      expect(cbox.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(cbox.x + cbox.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(cbox.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(cbox.y + cbox.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }

    await page.screenshot({
      path: testInfo.outputPath("top-mode.png"),
      fullPage: false,
    });
  });
});

test.describe("Center mode preference", () => {
  test("keeps an explicit full stacked layout after reload", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "sc_clock_pos_map",
        JSON.stringify({ digital: "center" }),
      );
      localStorage.setItem("sc_center_minimal", "0");
    });
    await page.goto("/");
    await waitForBoot(page);
    await closeThemePanel(page);

    await expect(page.locator("body")).toHaveClass(/clock-center/);
    await expect(page.locator("body")).not.toHaveClass(/center-minimal/);

    await page.reload();
    await waitForBoot(page);
    await closeThemePanel(page);

    await expect(page.locator("body")).toHaveClass(/clock-center/);
    await expect(page.locator("body")).not.toHaveClass(/center-minimal/);
    await expect(page.locator(".session-card")).toBeVisible();
    await expect(page.locator("#btnStart")).toBeVisible();
    const vp = page.viewportSize()!;
    const box = await page.locator(".session-card").boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Full stacked card is centred in the flow, not pinned to the right.
      expect(box.x).toBeLessThan(vp.width * 0.6);
    }
  });
});

test.describe("solid accent controls", () => {
  // Theme `btnFg` is tuned for translucent surfaces; several themes make it
  // equal to the accent. Solid accent buttons must derive their own ink.
  for (const theme of ["aurora", "terminal", "nordic", "lemon"]) {
    test(`Start button stays readable on the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((id) => {
        localStorage.setItem("sc_last_theme", id);
      }, theme);
      await page.goto("/");
      await waitForBoot(page);
      await closeThemePanel(page);

      const ratio = await page.locator("#btnStart").evaluate((el) => {
        const style = getComputedStyle(el);
        return { color: style.color, background: style.backgroundColor };
      });

      expect(ratio.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(contrastRatio(ratio.color, ratio.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }
});

test.describe("first-run welcome", () => {
  test.use({ firstRun: true });

  test("is content-led, readable, and keyboard usable", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await waitForBoot(page);

    const overlay = page.locator("#onboardOverlay");
    await expect(overlay).toHaveClass(/open/, { timeout: 12_000 });
    const card = page.locator(".sc-modal--onboard");
    await expect(card).toHaveClass(/is-welcome/);

    await expect(page.locator(".ob-eyebrow")).toBeVisible();
    await expect(page.locator(".ob-heading--welcome")).toHaveText(
      "Make time yours.",
    );
    await expect(page.locator(".ob-hint")).toHaveCount(3);
    await expect(page.locator(".ob-progress")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await expect(page.locator(".ob-progress")).toHaveAttribute(
      "aria-valuemax",
      "4",
    );
    await expect(page.locator(".ob-step-label")).toHaveText(
      "Welcome · Step 1 of 4",
    );

    // Content-led height: the card must not add a tall empty lower region.
    const cardBox = await card.boundingBox();
    const contentBox = await page.locator("#onboardContent .ob-wrapper").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    if (cardBox && contentBox) {
      expect(Math.abs(cardBox.height - contentBox.height)).toBeLessThanOrEqual(6);
      expect(cardBox.height).toBeLessThanOrEqual(640);
    }

    const primary = page.locator(".ob-btn-primary");
    const secondary = page.locator(".ob-btn-ghost");
    const skip = page.locator(".ob-skip-all");
    await expect(primary).toBeVisible();
    await expect(secondary).toBeVisible();
    await expect(skip).toBeVisible();

    // Both actions must sit inside the card, not overflow it.
    for (const action of [primary, secondary, skip]) {
      const abox = await action.boundingBox();
      expect(abox).not.toBeNull();
      if (abox && cardBox) {
        expect(abox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(abox.x + abox.width).toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 1,
        );
        expect(abox.y + abox.height).toBeLessThanOrEqual(
          cardBox.y + cardBox.height + 1,
        );
      }
    }

    await page.screenshot({
      path: testInfo.outputPath("welcome-dark.png"),
      fullPage: false,
    });

    await primary.focus();
    await expect(primary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ob-heading")).toHaveText("Session length?");
    await expect(page.locator(".ob-step-label")).toHaveText(
      "Session length · Step 2 of 4",
    );
    await expect(page.locator(".ob-progress")).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    await page.screenshot({
      path: testInfo.outputPath("duration-dark.png"),
      fullPage: false,
    });
  });

  test("Use defaults completes onboarding and persists the choice", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.locator("#onboardOverlay")).toHaveClass(/open/, {
      timeout: 12_000,
    });

    await page.locator(".ob-btn-ghost").click();
    await expect(page.locator("#onboardOverlay")).not.toHaveClass(/open/);
    const onboarded = await page.evaluate(() =>
      localStorage.getItem("sc_onboarded_v2"),
    );
    expect(onboarded).toBe("1");
  });

  test("Skip setup is a real, high-contrast secondary action", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.locator("#onboardOverlay")).toHaveClass(/open/, {
      timeout: 12_000,
    });

    const skip = page.locator(".ob-skip-all");
    const opacity = await skip.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity),
    );
    expect(opacity).toBeGreaterThanOrEqual(0.5);

    await skip.click();
    await expect(page.locator("#onboardOverlay")).not.toHaveClass(/open/);
  });

  test("light theme welcome and option-heavy step are theme-aware", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem("sc_last_theme", "nordic");
    });
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.locator("#onboardOverlay")).toHaveClass(/open/, {
      timeout: 12_000,
    });
    await expect(page.locator("body")).toHaveClass(/light-theme/);
    await page.screenshot({
      path: testInfo.outputPath("welcome-light.png"),
      fullPage: false,
    });

    await page.locator(".ob-btn-primary").click();
    await expect(page.locator(".ob-heading")).toHaveText("Session length?");
    await page.screenshot({
      path: testInfo.outputPath("duration-light.png"),
      fullPage: false,
    });
  });
});

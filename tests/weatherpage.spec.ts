import { test, expect, waitForBoot, closeThemePanel } from "./fixtures";

// Keep the service worker from intercepting synthetic city/forecast routes.
test.use({ reducedMotion: "reduce", serviceWorkers: "block" });

test("location dialog focuses on automatic and button opens, traps Tab, and restores focus", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await closeThemePanel(page);
  const trigger = page.locator("#weatherPill");
  await trigger.click();
  const panel = page.locator("#weatherLocationPanel");
  const search = page.locator("#weatherLocSearch");
  await expect(search).toBeFocused();
  await page.locator("#weatherLocGPS").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#weatherLocCancel")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#weatherLocGPS")).toBeFocused();
  await page.locator("#weatherLocCancel").click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(trigger).toBeFocused();
  await expect(panel).toHaveAttribute("inert", "");

  const setLocation = page.locator("#weatherSetLocationBtn");
  await setLocation.click();
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveClass(/open/);
  await expect(setLocation).toBeFocused();
  await expect(page.locator("#weatherPageOverlay")).toHaveClass(/open/);
  await setLocation.click();
  await expect(search).toBeFocused();
  await page.locator("#weatherCloseBtn").click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(trigger).toBeFocused();
});

test("the command palette owns focus and Escape above the location picker", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await closeThemePanel(page);
  await page.locator("#weatherPill").click();
  const panel = page.locator("#weatherLocationPanel");
  const search = page.locator("#weatherLocSearch");
  const palette = page.locator("#cmdOverlay");
  const paletteInput = page.locator("#cmdInput");
  // Close the picker auto-opened by the first visit, then open it from the
  // Set location control so Escape has a visible control to return focus to.
  await page.locator("#weatherLocCancel").click();
  await page.locator("#weatherSetLocationBtn").click();
  await expect(panel).toHaveClass(/open/);
  await expect(search).toBeFocused();

  await page.keyboard.press("Control+k");
  await expect(palette).toHaveClass(/open/);
  await expect(paletteInput).toBeFocused();

  // Typing must reach the palette, not the city search behind it.
  await page.keyboard.type("theme");
  await expect(paletteInput).toHaveValue("theme");
  await expect(search).toHaveValue("");

  // Escape closes the topmost layer only, then focus returns to the picker.
  await page.keyboard.press("Escape");
  await expect(palette).not.toHaveClass(/open/);
  await expect(panel).toHaveClass(/open/);
  await expect(search).toBeFocused();

  // The picker still owns Escape once the palette is gone.
  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveClass(/open/);
  await expect(page.locator("#weatherPageOverlay")).toHaveClass(/open/);
  await expect(page.locator("#weatherSetLocationBtn")).toBeFocused();
});

test("city selection restores focus and names daily condition icons", async ({ page }) => {
  await page.route("https://nominatim.openstreetmap.org/search?*", (route) => route.fulfill({
    json: [{ display_name: "London, UK", lat: "51.5", lon: "-0.12", address: { city: "London", country: "UK" } }],
  }));
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({
    json: {
      current: { weathercode: 0, temperature_2m: 20, apparent_temperature: 19, windspeed_10m: 5, relativehumidity_2m: 60 },
      daily: { time: ["2026-10-25"], temperature_2m_min: [10], temperature_2m_max: [20], weathercode: [0] },
    },
  }));
  await page.goto("/");
  await waitForBoot(page);
  await closeThemePanel(page);
  await page.locator("#weatherPill").click();
  await page.locator("#weatherLocCancel").click();
  await page.locator("#weatherSetLocationBtn").click();
  await page.locator("#weatherLocSearch").fill("London");
  await page.locator(".weather-loc-result").click();
  await expect(page.locator("#weatherSetLocationBtn")).toBeFocused();
  await expect(page.locator("#weatherLocationPanel")).not.toHaveClass(/open/);
  await expect(page.locator(".weather-daily-icon")).toHaveAttribute("title", "Clear");
  await expect(page.locator(".weather-daily-icon")).toHaveAccessibleName("Clear");
  await expect(page.locator(".weather-daily-icon")).toHaveRole("img");
});

test("GPS success restores focus to the location control", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 51.5, longitude: -0.12 });
  await page.route("https://nominatim.openstreetmap.org/reverse?*", (route) => route.fulfill({ json: { address: { city: "London" } } }));
  await page.goto("/");
  await waitForBoot(page);
  await closeThemePanel(page);
  await page.locator("#weatherPill").click();
  await page.locator("#weatherLocCancel").click();
  await page.locator("#weatherSetLocationBtn").click();
  await page.locator("#weatherLocGPS").click();
  await expect(page.locator("#weatherLocationPanel")).not.toHaveClass(/open/);
  await expect(page.locator("#weatherSetLocationBtn")).toBeFocused();
});

for (const [locale, room, search, unavailable, retry] of [
  ["en", "Weather Room", "Search for a city…", "GPS unavailable", "Search for a city instead"],
  ["es", "Sala del tiempo", "Busca una ciudad…", "GPS no disponible", "Busca una ciudad en su lugar"],
  ["fr", "Espace météo", "Rechercher une ville…", "GPS indisponible", "Recherchez plutôt une ville"],
  ["de", "Wetterraum", "Nach einer Stadt suchen…", "GPS nicht verfügbar", "Suche stattdessen nach einer Stadt"],
  ["ja", "天気ルーム", "都市を検索…", "位置情報を取得できません", "代わりに都市を検索してください"],
  ["ko", "날씨 공간", "도시 검색…", "GPS를 사용할 수 없습니다", "대신 도시를 검색해 주세요"],
  ["pt", "Sala do tempo", "Buscar uma cidade…", "GPS indisponível", "Busque uma cidade"],
  ["hi", "मौसम कक्ष", "शहर खोजें…", "GPS उपलब्ध नहीं है", "इसके बजाय शहर खोजें"],
]) {
  test(`weather copy and GPS failure use the ${locale} locale`, async ({ page }) => {
    await page.addInitScript((lang) => {
      localStorage.setItem("sc_locale", lang);
      Object.defineProperty(navigator, "geolocation", { value: {
        getCurrentPosition: (_success: unknown, fail: () => void) => fail(),
      } });
    }, locale);
    await page.goto("/");
    await waitForBoot(page);
    await closeThemePanel(page);
    await page.locator("#weatherPill").click();
    await expect(page.locator(".weather-page-kicker")).toHaveText(room);
    await expect(page.locator("#weatherLocSearch")).toHaveAttribute("placeholder", search);
    await page.locator("#weatherLocGPS").click();
    await expect(page.locator("#weatherLocGPS .weather-loc-btn-label")).toHaveText(unavailable);
    await expect(page.locator("#weatherLocGPS .weather-loc-btn-sub")).toHaveText(retry);
  });
}

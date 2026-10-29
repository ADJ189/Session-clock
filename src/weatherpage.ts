// ── Weather Page Module ────────────────────────────────────────────────
// Apple Weather-inspired, highly engineered weather information page

import {
  getCurrentTemp,
  getFeelsLike,
  getWind,
  getHumidity,
  getWeatherDesc,
  getWeatherOverlay,
  getWeatherCode,
  getHourlyForecast,
  getDailyForecast,
  getSunTimes,
  getWMOInfo,
  setManualLocation,
  getStoredLocation,
  initWeather,
  getCityName,
  didWeatherFail,
} from "./weather";
import { fetchWithTimeout } from "./utils";
import { t, type Strings } from "./i18n";

let _privacyCheck: () => boolean = () => false;
let _onWeatherUpdate:
  | ((code: number, temp: number, desc: string) => void)
  | null = null;

export function setWeatherPageCallbacks(
  privacyCheck: () => boolean,
  onUpdate: (code: number, temp: number, desc: string) => void,
) {
  _privacyCheck = privacyCheck;
  _onWeatherUpdate = onUpdate;
}

// ── Condition art ─────────────────────────────────────────────────────
// The application chrome uses one consistent line-icon language. Weather
// conditions get their own small family in that style — emoji are kept only
// as data fallbacks, never as the main visual system.
type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "unknown";

function weatherKind(code: number | null): WeatherKind {
  if (code === null) return "unknown";
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "unknown";
}

function weatherIconSvg(code: number | null, size = 28): string {
  const kind = weatherKind(code);
  const open = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
  switch (kind) {
    case "clear":
      return `${open}<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
    case "partly":
      return `${open}<circle cx="9" cy="9" r="3.2"/><path d="M9 2.8v1.4M3.8 9h1.4M5.3 5.3l1 1"/><path d="M8.5 18.5a4 4 0 0 1-.3-7.98A4.6 4.6 0 0 1 16.9 10a3.6 3.6 0 0 1 1.1 7h-9.5Z"/></svg>`;
    case "cloudy":
      return `${open}<path d="M7 18.5a4.2 4.2 0 0 1-.4-8.38A5 5 0 0 1 16.2 9.1 3.9 3.9 0 0 1 17.5 17H7Z"/></svg>`;
    case "rain":
      return `${open}<path d="M7 15.5a4.2 4.2 0 0 1-.4-8.38A5 5 0 0 1 16.2 6.1 3.9 3.9 0 0 1 17.5 14H7Z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/></svg>`;
    case "storm":
      return `${open}<path d="M7 14.5a4.2 4.2 0 0 1-.4-8.38A5 5 0 0 1 16.2 5.1 3.9 3.9 0 0 1 17.5 13H7Z"/><path d="m12.5 14-2.2 4h3l-1.6 4 4.2-5h-3Z"/></svg>`;
    case "snow":
      return `${open}<path d="M7 14.5a4.2 4.2 0 0 1-.4-8.38A5 5 0 0 1 16.2 5.1 3.9 3.9 0 0 1 17.5 13H7Z"/><path d="M8 17v4M6.3 18l3.4 2M9.7 18l-3.4 2M16 17v4M14.3 18l3.4 2M17.7 18l-3.4 2"/></svg>`;
    case "fog":
      return `${open}<path d="M5 9h10M8 12h11M4 15h10M9 18h11"/></svg>`;
    default:
      return `${open}<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>`;
  }
}

const PIN_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const GPS_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/></svg>';
const SUNRISE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 3v3M5.6 6.6l1.4 1.4M18.4 6.6 17 8"/></svg>';
const SUNSET_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6v3M5.6 10.6l1.4-1.4M18.4 10.6 17 9.2"/></svg>';


let locationReturnFocus: HTMLElement | null = null;
let weatherReturnFocus: HTMLElement | null = null;

/**
 * The command palette is rendered above the weather page (z-index 10000 vs
 * 3000). While it is open it owns keyboard focus and Escape; the picker's
 * focus trap must not pull focus back behind it.
 */
function commandPaletteOwnsFocus(): boolean {
  return document.getElementById("cmdOverlay")?.classList.contains("open") ?? false;
}

function openLocationPanel(overlay: HTMLElement, trigger: HTMLElement | null) {
  const panel = overlay.querySelector<HTMLElement>("#weatherLocationPanel")!;
  if (!panel.classList.contains("open")) locationReturnFocus = trigger;
  panel.inert = false;
  panel.removeAttribute("aria-hidden");
  panel.classList.add("open");
  panel.querySelector<HTMLInputElement>("#weatherLocSearch")!.focus({ preventScroll: true });
}

function closeLocationPanel(overlay: HTMLElement, restoreFocus = true) {
  const panel = overlay.querySelector<HTMLElement>("#weatherLocationPanel")!;
  if (!panel.classList.contains("open")) return;
  panel.classList.remove("open");
  if (restoreFocus && locationReturnFocus?.isConnected)
    locationReturnFocus.focus({ preventScroll: true });
  locationReturnFocus = null;
  panel.inert = true;
  panel.setAttribute("aria-hidden", "true");
}

// ── Open the weather page overlay ─────────────────────────────────────
export function openWeatherPage(trigger?: HTMLElement) {
  weatherReturnFocus = trigger ?? (document.activeElement instanceof HTMLElement
    ? document.activeElement : null);
  let overlay = document.getElementById("weatherPageOverlay");
  if (!overlay) {
    overlay = buildWeatherPageDOM();
    document.body.appendChild(overlay);
  }
  overlay.classList.add("open");
  renderWeatherPage(overlay as HTMLElement);
  window.addEventListener("sc-weather-update", handleWeatherUpdate);
  window.addEventListener("sc:locale", handleWeatherUpdate);

  // No location yet — go straight to the picker dialog instead of
  // leaving the user staring at an empty hero section.
  if (!getStoredLocation()) {
    openLocationPanel(overlay, weatherReturnFocus && weatherReturnFocus !== document.body
      ? weatherReturnFocus : overlay.querySelector<HTMLElement>("#weatherSetLocationBtn"));
  }
}

export function closeWeatherPage() {
  const overlay = document.getElementById("weatherPageOverlay");
  if (overlay) closeLocationPanel(overlay, false);
  overlay?.classList.remove("open");
  if (weatherReturnFocus?.isConnected) weatherReturnFocus.focus({ preventScroll: true });
  weatherReturnFocus = null;
  window.removeEventListener("sc-weather-update", handleWeatherUpdate);
  window.removeEventListener("sc:locale", handleWeatherUpdate);
}

function handleWeatherUpdate() {
  const overlay = document.getElementById("weatherPageOverlay");
  if (overlay?.classList.contains("open"))
    renderWeatherPage(overlay as HTMLElement);
}

// ── DOM builder ────────────────────────────────────────────────────────
function buildWeatherPageDOM(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = "weatherPageOverlay";
  overlay.className = "weather-page-overlay sc-overlay";
  overlay.innerHTML = `
    <div class="weather-page" id="weatherPageInner">
      <div class="weather-page-bg" id="weatherPageBg"></div>
      <header class="weather-page-header">
        <button class="weather-close-btn" id="weatherCloseBtn" data-weather-label="weatherClose" aria-label="${t().weatherClose}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="weather-page-location">
          <span class="weather-page-kicker" data-weather-text="weatherRoom">${t().weatherRoom}</span>
          <span class="weather-location-name" id="weatherLocationName">—</span>
          <span class="weather-location-time" id="weatherLocationTime"></span>
        </div>
        <button class="weather-set-location-btn" id="weatherSetLocationBtn" data-weather-title="weatherSetLocation" title="${t().weatherSetLocation}" data-weather-label="weatherSetLocationLabel" aria-label="${t().weatherSetLocationLabel}">
          ${PIN_SVG}
          <span data-weather-text="weatherSetLocation">${t().weatherSetLocation}</span>
        </button>
      </header>

      <div class="weather-page-content" id="weatherPageContent">
        <div class="weather-hero" id="weatherHero">
          <div class="weather-hero-particles" id="weatherHeroParticles"></div>
          <div class="weather-hero-copy">
            <span class="weather-hero-kicker" id="weatherHeroKicker" data-weather-text="weatherCurrentConditions">${t().weatherCurrentConditions}</span>
            <div class="weather-hero-main">
              <span class="weather-condition-icon" id="weatherConditionIcon">${weatherIconSvg(null, 64)}</span>
              <div class="weather-hero-reading">
                <div class="weather-hero-temp" id="weatherHeroTemp">--°</div>
                <div class="weather-hero-desc" id="weatherHeroDesc" data-weather-text="weatherLoading">${t().weatherLoading}</div>
              </div>
            </div>
            <div class="weather-hero-meta" id="weatherHeroMeta">
              <span class="weather-meta-chip" id="weatherFeels">${t().weatherFeelsLike.replace("{temp}", "--")}</span>
              <span class="weather-meta-chip" id="weatherWind">-- km/h</span>
              <span class="weather-meta-chip" id="weatherHumidity">--%</span>
            </div>
          </div>
        </div>

        <div class="weather-section weather-section--hourly">
          <div class="weather-section-head">
            <div>
              <span class="weather-section-eyebrow" data-weather-text="weatherNext24Hours">${t().weatherNext24Hours}</span>
              <h3 class="weather-section-label" data-weather-text="weatherHourly">${t().weatherHourly}</h3>
            </div>
            <span class="weather-section-note" data-weather-text="weatherSwipe">${t().weatherSwipe}</span>
          </div>
          <div class="weather-hourly-strip" id="weatherHourlyStrip"></div>
        </div>

        <div class="weather-section weather-section--sun">
          <div class="weather-section-head">
            <div>
              <span class="weather-section-eyebrow" data-weather-text="weatherDaylight">${t().weatherDaylight}</span>
              <h3 class="weather-section-label" data-weather-text="weatherSunPath">${t().weatherSunPath}</h3>
            </div>
          </div>
          <div class="weather-sun-arc-wrap">
            <canvas class="weather-sun-canvas" id="weatherSunCanvas" width="360" height="100"></canvas>
            <div class="weather-sun-times" id="weatherSunTimes"></div>
          </div>
        </div>

        <div class="weather-section weather-section--daily">
          <div class="weather-section-head">
            <div>
              <span class="weather-section-eyebrow" data-weather-text="weatherWeekAhead">${t().weatherWeekAhead}</span>
              <h3 class="weather-section-label" data-weather-text="weatherDailyForecast">${t().weatherDailyForecast}</h3>
            </div>
          </div>
          <div class="weather-daily-list" id="weatherDailyList"></div>
        </div>

        <div class="weather-section weather-section--theme-control">
          <div class="weather-theme-toggle-row">
            <div class="weather-theme-toggle-info">
              <span class="weather-theme-toggle-label" data-weather-text="weatherAdaptiveTheme">${t().weatherAdaptiveTheme}</span>
              <span class="weather-theme-toggle-desc" data-weather-text="weatherAdaptiveThemeDesc">${t().weatherAdaptiveThemeDesc}</span>
            </div>
            <button class="settings-toggle" id="weatherThemeToggle" data-weather-label="weatherAdaptiveTheme" aria-label="${t().weatherAdaptiveTheme}" aria-pressed="true"></button>
          </div>
        </div>
      </div>

      <div class="weather-location-panel" id="weatherLocationPanel" inert aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="weatherLocTitle">
        <div class="weather-location-panel-header">
          <div>
            <span class="weather-section-eyebrow" data-weather-text="weatherForecastSource">${t().weatherForecastSource}</span>
            <span id="weatherLocTitle" data-weather-text="weatherSetLocation">${t().weatherSetLocation}</span>
          </div>
          <button class="weather-loc-cancel" id="weatherLocCancel" data-weather-text="weatherDone">${t().weatherDone}</button>
        </div>
        <div class="weather-loc-options">
          <div class="weather-loc-search-wrap">
            <svg class="weather-loc-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input class="weather-loc-search" id="weatherLocSearch" type="text" data-weather-placeholder="weatherSearchPlaceholder" placeholder="${t().weatherSearchPlaceholder}" data-weather-label="weatherSearchLabel" aria-label="${t().weatherSearchLabel}" autocomplete="off" spellcheck="false">
          </div>
          <div class="weather-loc-results" id="weatherLocResults"></div>
          <div class="weather-loc-sep"><span data-weather-text="weatherOr">${t().weatherOr}</span></div>
          <button class="weather-loc-btn" id="weatherLocGPS">
            <span class="weather-loc-icon">${GPS_SVG}</span>
            <span>
              <span class="weather-loc-btn-label" data-weather-text="weatherUseLocation">${t().weatherUseLocation}</span>
              <span class="weather-loc-btn-sub" data-weather-text="weatherGPSHint">${t().weatherGPSHint}</span>
            </span>
          </button>
          <p class="weather-loc-privacy" data-weather-text="weatherLocationPrivacy">${t().weatherLocationPrivacy}</p>
        </div>
      </div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWeatherPage();
  });
  overlay
    .querySelector("#weatherCloseBtn")!
    .addEventListener("click", closeWeatherPage);

  overlay.querySelector("#weatherHero")!.addEventListener("click", () => {
    if (
      (
        overlay!.querySelector("#weatherHero") as HTMLElement
      ).classList.contains("weather-hero--retry")
    ) {
      refreshWeather(overlay as HTMLElement);
    }
  });

  overlay
    .querySelector("#weatherSetLocationBtn")!
    .addEventListener("click", () => {
      openLocationPanel(overlay, overlay.querySelector<HTMLElement>("#weatherSetLocationBtn"));
    });
  overlay.querySelector("#weatherLocCancel")!.addEventListener("click", () => {
    closeLocationPanel(overlay);
  });

  const panel = overlay.querySelector<HTMLElement>("#weatherLocationPanel")!;
  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    // Let the command palette (a higher layer) own Escape and Tab.
    if (commandPaletteOwnsFocus()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (panel.classList.contains("open")) closeLocationPanel(overlay);
      else closeWeatherPage();
      return;
    }
    if (e.key !== "Tab" || !panel.classList.contains("open")) return;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active) || (e.shiftKey ? active === first : active === last)) {
      e.preventDefault();
      (e.shiftKey ? last : first)?.focus({ preventScroll: true });
    }
  }, true);
  document.addEventListener("focusin", (e) => {
    if (commandPaletteOwnsFocus()) return;
    if (overlay.classList.contains("open") && panel.classList.contains("open") &&
        !panel.contains(e.target as Node)) {
      panel.querySelector<HTMLInputElement>("#weatherLocSearch")!.focus({ preventScroll: true });
    }
  });

  // GPS
  overlay.querySelector("#weatherLocGPS")!.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    const btn = overlay.querySelector("#weatherLocGPS") as HTMLButtonElement;
    btn.innerHTML =
      `<span class="weather-loc-icon">${GPS_SVG}</span><span><span class="weather-loc-btn-label" data-weather-text="weatherLocating">${t().weatherLocating}</span><span class="weather-loc-btn-sub" data-weather-text="weatherPleaseWait">${t().weatherPleaseWait}</span></span>`;
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        const name = await getCityName(lat, lon);
        setManualLocation(lat, lon, name);
        closeLocationPanel(overlay);
        refreshWeather(overlay as HTMLElement);
      },
      () => {
        btn.innerHTML =
          `<span class="weather-loc-icon">${PIN_SVG}</span><span><span class="weather-loc-btn-label" data-weather-text="weatherGPSUnavailable">${t().weatherGPSUnavailable}</span><span class="weather-loc-btn-sub" data-weather-text="weatherSearchInstead">${t().weatherSearchInstead}</span></span>`;
      },
      { timeout: 10000 },
    );
  });

  // City search
  const searchInput = overlay.querySelector(
    "#weatherLocSearch",
  ) as HTMLInputElement;
  let searchTimer = 0;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      // Bump the token even on this short-circuit path — otherwise a
      // search already in flight (e.g. for "London") still passes its
      // `myRequestId !== searchRequestId` check once it resolves, since
      // nothing here had changed searchRequestId, and repopulates
      // #weatherLocResults with results for a query the input no longer
      // shows at all.
      searchRequestId++;
      (overlay.querySelector("#weatherLocResults") as HTMLElement).innerHTML =
        "";
      return;
    }
    searchTimer = window.setTimeout(
      () => searchCity(q, overlay as HTMLElement),
      400,
    );
  });

  // Weather theme toggle
  const themeToggle = overlay.querySelector(
    "#weatherThemeToggle",
  ) as HTMLButtonElement;
  const isEnabled = localStorage.getItem("sc_weather_theme") !== "0";
  themeToggle.classList.toggle("on", isEnabled);
  themeToggle.setAttribute("aria-pressed", String(isEnabled));
  document.body.classList.toggle("weather-overlay-on", isEnabled);
  themeToggle.addEventListener("click", () => {
    const now = !themeToggle.classList.contains("on");
    themeToggle.classList.toggle("on", now);
    themeToggle.setAttribute("aria-pressed", String(now));
    localStorage.setItem("sc_weather_theme", now ? "1" : "0");
    document.body.classList.toggle("weather-overlay-on", now);
    window.dispatchEvent(
      new CustomEvent("sc-weather-theme-toggle", { detail: { enabled: now } }),
    );
  });

  return overlay;
}

// Bumped on every call so a slower/out-of-order network response for an
// older query (e.g. "Lon") can't overwrite a newer query's results (e.g.
// "London") if the user keeps typing while the first request is still in
// flight — same stale-response race as the Music Dock lyrics lookup.
let searchRequestId = 0;

/** The subset of a Nominatim /search result (addressdetails=1) used below. */
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

async function searchCity(query: string, overlay: HTMLElement) {
  const results = overlay.querySelector("#weatherLocResults") as HTMLElement;
  results.innerHTML = `<div class="weather-loc-loading">${t().weatherSearching}</div>`;
  const myRequestId = ++searchRequestId;
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
      { headers: { "Accept-Language": "en" } },
      8000,
    );
    const data: NominatimResult[] = await res.json();
    if (myRequestId !== searchRequestId) return; // a newer search has since started — this result is stale
    results.innerHTML = "";
    if (!data.length) {
      results.innerHTML =
        `<div class="weather-loc-loading">${t().weatherNoResults}</div>`;
      return;
    }
    data.forEach((item: NominatimResult) => {
      const name =
        item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.display_name.split(",")[0];
      const sub = [item.address?.state, item.address?.country]
        .filter(Boolean)
        .join(", ");
      const btn = document.createElement("button");
      btn.className = "weather-loc-result";
      // Built via textContent, not innerHTML — `name`/`sub` come straight
      // from the Nominatim API response and are untrusted external data.
      const nameEl = document.createElement("span");
      nameEl.className = "weather-loc-result-name";
      nameEl.textContent = name;
      const subEl = document.createElement("span");
      subEl.className = "weather-loc-result-sub";
      subEl.textContent = sub;
      btn.appendChild(nameEl);
      btn.appendChild(subEl);
      btn.addEventListener("click", () => {
        setManualLocation(parseFloat(item.lat), parseFloat(item.lon), name);
        closeLocationPanel(overlay);
        refreshWeather(overlay);
      });
      results.appendChild(btn);
    });
  } catch {
    if (myRequestId !== searchRequestId) return;
    results.innerHTML = `<div class="weather-loc-loading">${t().weatherSearchFailed}</div>`;
  }
}

function refreshWeather(overlay: HTMLElement) {
  const iconEl = document.getElementById("weatherIcon");
  const textEl = document.getElementById("weatherText");
  const pillEl = document.getElementById("weatherPill");
  if (iconEl && textEl && pillEl) {
    initWeather(
      iconEl,
      textEl,
      pillEl,
      _privacyCheck,
      _onWeatherUpdate ?? undefined,
    );
  }
  setTimeout(() => renderWeatherPage(overlay), 1800);
}

// ── Main render ────────────────────────────────────────────────────────
export function renderWeatherPage(overlay: HTMLElement) {
  const strings = t();
  for (const [dataAttr, attr] of [
    ["data-weather-text", ""], ["data-weather-label", "aria-label"],
    ["data-weather-title", "title"], ["data-weather-placeholder", "placeholder"],
  ]) {
    overlay.querySelectorAll<HTMLElement>(`[${dataAttr}]`).forEach((el) => {
      const value = strings[el.getAttribute(dataAttr) as keyof Strings];
      if (attr) el.setAttribute(attr, value);
      else el.textContent = value;
    });
  }

  const temp = getCurrentTemp();
  const feels = getFeelsLike();
  const wind = getWind();
  const humidity = getHumidity();
  const desc = getWeatherDesc();
  const overlayType = getWeatherOverlay();
  const stored = getStoredLocation();
  const code = getWeatherCode() ?? 0;

  // Location / time
  (overlay.querySelector("#weatherLocationName") as HTMLElement).textContent =
    stored?.name || (temp !== null ? t().weatherCurrentLocation : t().weatherNoLocation);
  (overlay.querySelector("#weatherLocationTime") as HTMLElement).textContent =
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Background gradient
  const bg = overlay.querySelector("#weatherPageBg") as HTMLElement;
  bg.className = `weather-page-bg weather-bg-${overlayType}`;

  // Hero
  const iconEl = overlay.querySelector("#weatherConditionIcon") as HTMLElement;
  const tempEl = overlay.querySelector("#weatherHeroTemp") as HTMLElement;
  const descEl = overlay.querySelector("#weatherHeroDesc") as HTMLElement;
  const feelsEl = overlay.querySelector("#weatherFeels") as HTMLElement;
  const windEl = overlay.querySelector("#weatherWind") as HTMLElement;
  const humEl = overlay.querySelector("#weatherHumidity") as HTMLElement;
  const kickerEl = overlay.querySelector("#weatherHeroKicker") as HTMLElement;

  const heroEl = overlay.querySelector("#weatherHero") as HTMLElement;

  if (temp !== null) {
    iconEl.innerHTML = weatherIconSvg(code, 64);
    tempEl.textContent = `${temp}°`;
    descEl.textContent = desc;
    kickerEl.textContent = t().weatherCurrentConditions;
    feelsEl.textContent = t().weatherFeelsLike.replace("{temp}", String(feels));
    windEl.textContent = t().weatherWindSpeed.replace("{speed}", String(wind));
    humEl.textContent = t().weatherHumidity.replace("{humidity}", String(humidity));
    heroEl.classList.remove("weather-hero--retry");
  } else if (stored && didWeatherFail()) {
    iconEl.innerHTML = weatherIconSvg(null, 64);
    tempEl.textContent = "--°";
    descEl.textContent = t().weatherUnavailable;
    kickerEl.textContent = t().weatherConnectionPaused;
    feelsEl.textContent = "";
    windEl.textContent = "";
    humEl.textContent = "";
    heroEl.classList.add("weather-hero--retry");
  } else {
    iconEl.innerHTML = weatherIconSvg(null, 64);
    tempEl.textContent = "--°";
    descEl.textContent = stored
      ? t().weatherFetching
      : t().weatherBegin;
    kickerEl.textContent = stored ? t().weatherReadingSky : t().weatherRoom;
    feelsEl.textContent = "";
    windEl.textContent = "";
    humEl.textContent = "";
    heroEl.classList.remove("weather-hero--retry");
  }

  // Particles
  const particles = overlay.querySelector(
    "#weatherHeroParticles",
  ) as HTMLElement;
  particles.className = `weather-hero-particles weather-particles-${overlayType}`;

  renderHourly(overlay);
  renderSunArc(overlay);
  renderDaily(overlay);
}

function renderHourly(overlay: HTMLElement) {
  const strip = overlay.querySelector("#weatherHourlyStrip") as HTMLElement;
  strip.innerHTML = "";
  const forecast = getHourlyForecast();
  if (!forecast.length) {
    strip.innerHTML =
      `<div class="weather-hourly-empty">${t().weatherNoForecast}</div>`;
    return;
  }
  forecast.slice(0, 24).forEach((h, i) => {
    const time = new Date(h.time);
    const label =
      i === 0 ? t().weatherNow : time.toLocaleTimeString([], { hour: "numeric" });
    const condition = getWMOInfo(h.code)[1];
    const item = document.createElement("div");
    item.className = "weather-hourly-item";
    // The icon is decorative; name the condition on its wrapper so the hour
    // reads as "Now, Drizzle, 9°" instead of "Now, 9°".
    item.innerHTML = `<span class="weather-hourly-time">${label}</span><span class="weather-hourly-icon" role="img" aria-label="${condition}">${weatherIconSvg(h.code, 26)}</span><span class="weather-hourly-temp">${h.temp}°</span>`;
    strip.appendChild(item);
  });
}

function renderSunArc(overlay: HTMLElement) {
  const canvas = overlay.querySelector(
    "#weatherSunCanvas",
  ) as HTMLCanvasElement;
  const sunTimesEl = overlay.querySelector("#weatherSunTimes") as HTMLElement;
  const sun = getSunTimes();
  if (!sun) {
    sunTimesEl.innerHTML =
      `<span class="weather-sun-empty">${t().weatherSunLocationHint}</span>`;
    return;
  }
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const toX = (mins: number) => (mins / 1440) * W;
  const riseX = toX(sun.rise),
    setX = toX(sun.set),
    midX = (riseX + setX) / 2;

  // Full arc (dim)
  ctx.beginPath();
  ctx.moveTo(riseX, H - 8);
  ctx.quadraticCurveTo(midX, 8, setX, H - 8);
  ctx.strokeStyle = "rgba(255,200,80,.2)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Elapsed arc (bright)
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const pct = Math.max(
    0,
    Math.min(1, (nowMins - sun.rise) / (sun.set - sun.rise)),
  );
  if (pct > 0 && pct <= 1) {
    const elapsedX = riseX + pct * (setX - riseX);
    const elapsedY = H - 8 - Math.sin(pct * Math.PI) * (H - 16);
    ctx.beginPath();
    ctx.moveTo(riseX, H - 8);
    ctx.quadraticCurveTo(midX, 8, elapsedX, elapsedY);
    ctx.strokeStyle = "rgba(255,200,80,.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Sun dot
    ctx.beginPath();
    ctx.arc(elapsedX, elapsedY, 7, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(
      elapsedX,
      elapsedY,
      0,
      elapsedX,
      elapsedY,
      7,
    );
    g.addColorStop(0, "#fff8c0");
    g.addColorStop(1, "#ffb300");
    ctx.fillStyle = g;
    ctx.fill();
  }
  // Horizon
  ctx.beginPath();
  ctx.moveTo(0, H - 8);
  ctx.lineTo(W, H - 8);
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60),
      m = mins % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  sunTimesEl.innerHTML = `
    <span class="weather-sun-time">
      <span class="weather-sun-ico">${SUNRISE_SVG}</span>
      <span><span class="weather-sun-label">${t().weatherSunrise}</span><strong>${fmt(Math.round(sun.rise))}</strong></span>
    </span>
    <span class="weather-sun-time">
      <span class="weather-sun-ico">${SUNSET_SVG}</span>
      <span><span class="weather-sun-label">${t().weatherSunset}</span><strong>${fmt(Math.round(sun.set))}</strong></span>
    </span>`;
}

function renderDaily(overlay: HTMLElement) {
  const list = overlay.querySelector("#weatherDailyList") as HTMLElement;
  list.innerHTML = "";
  const forecast = getDailyForecast();
  if (!forecast.length) return;
  const maxT = Math.max(...forecast.map((d) => d.maxTemp));
  const minT = Math.min(...forecast.map((d) => d.minTemp));
  const range = maxT - minT || 1;
  forecast.forEach((d, i) => {
    const [, desc] = getWMOInfo(d.code);
    const date = new Date(d.date + "T12:00:00");
    const dayLabel =
      i === 0 ? t().weatherToday : date.toLocaleDateString([], { weekday: "short" });
    const barLeft = ((d.minTemp - minT) / range) * 100;
    const barWidth = Math.max(((d.maxTemp - d.minTemp) / range) * 100, 8);
    const row = document.createElement("div");
    row.className = "weather-daily-row";
    row.innerHTML = `
      <span class="weather-daily-day">${dayLabel}</span>
      <span class="weather-daily-icon" role="img" title="${desc}" aria-label="${desc}">${weatherIconSvg(d.code, 18)}</span>
      <div class="weather-daily-bar-wrap">
        <span class="weather-daily-min">${d.minTemp}°</span>
        <div class="weather-daily-bar"><div class="weather-daily-bar-fill" style="left:${barLeft.toFixed(1)}%;width:${barWidth.toFixed(1)}%"></div></div>
        <span class="weather-daily-max">${d.maxTemp}°</span>
      </div>`;
    list.appendChild(row);
  });
}

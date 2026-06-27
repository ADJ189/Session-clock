// ── Weather Page Module ────────────────────────────────────────────────
// Apple Weather-inspired, highly engineered weather information page

import {
  getCurrentTemp, getFeelsLike, getWind, getHumidity,
  getWeatherDesc, getWeatherOverlay, getWeatherCode,
  getHourlyForecast, getDailyForecast,
  getSunTimes, getWMOInfo,
  setManualLocation, getStoredLocation, initWeather,
  type WeatherOverlay,
} from './weather';

let _privacyCheck: () => boolean = () => false;
let _onWeatherUpdate: ((code: number, temp: number, desc: string) => void) | null = null;

export function setWeatherPageCallbacks(
  privacyCheck: () => boolean,
  onUpdate: (code: number, temp: number, desc: string) => void,
) {
  _privacyCheck = privacyCheck;
  _onWeatherUpdate = onUpdate;
}

// ── Open the weather page overlay ─────────────────────────────────────
export function openWeatherPage() {
  let overlay = document.getElementById('weatherPageOverlay');
  if (!overlay) {
    overlay = buildWeatherPageDOM();
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  renderWeatherPage(overlay as HTMLElement);
  window.addEventListener('sc-weather-update', handleWeatherUpdate);
}

export function closeWeatherPage() {
  const overlay = document.getElementById('weatherPageOverlay');
  overlay?.classList.remove('open');
  window.removeEventListener('sc-weather-update', handleWeatherUpdate);
}

function handleWeatherUpdate() {
  const overlay = document.getElementById('weatherPageOverlay');
  if (overlay?.classList.contains('open')) renderWeatherPage(overlay as HTMLElement);
}

// ── DOM builder ────────────────────────────────────────────────────────
function buildWeatherPageDOM(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'weatherPageOverlay';
  overlay.className = 'weather-page-overlay sc-overlay';
  overlay.innerHTML = `
    <div class="weather-page" id="weatherPageInner">
      <div class="weather-page-bg" id="weatherPageBg"></div>
      <header class="weather-page-header">
        <button class="weather-close-btn" id="weatherCloseBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="weather-page-location">
          <span class="weather-location-name" id="weatherLocationName">—</span>
          <span class="weather-location-time" id="weatherLocationTime"></span>
        </div>
        <button class="weather-set-location-btn" id="weatherSetLocationBtn" title="Set location">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          Set location
        </button>
      </header>

      <div class="weather-page-content" id="weatherPageContent">
        <div class="weather-hero" id="weatherHero">
          <div class="weather-hero-particles" id="weatherHeroParticles"></div>
          <div class="weather-condition-icon" id="weatherConditionIcon">🌤</div>
          <div class="weather-hero-temp" id="weatherHeroTemp">--°</div>
          <div class="weather-hero-desc" id="weatherHeroDesc">Loading…</div>
          <div class="weather-hero-meta" id="weatherHeroMeta">
            <span id="weatherFeels">Feels like --°</span>
            <span class="weather-meta-sep">·</span>
            <span id="weatherWind">-- km/h</span>
            <span class="weather-meta-sep">·</span>
            <span id="weatherHumidity">--%</span>
          </div>
        </div>

        <div class="weather-section weather-section--hourly">
          <div class="weather-section-label">Next 24 hours</div>
          <div class="weather-hourly-strip" id="weatherHourlyStrip"></div>
        </div>

        <div class="weather-section weather-section--sun">
          <div class="weather-section-label">Daylight</div>
          <div class="weather-sun-arc-wrap">
            <canvas class="weather-sun-canvas" id="weatherSunCanvas" width="360" height="100"></canvas>
            <div class="weather-sun-times" id="weatherSunTimes"></div>
          </div>
        </div>

        <div class="weather-section weather-section--daily">
          <div class="weather-section-label">7-Day Forecast</div>
          <div class="weather-daily-list" id="weatherDailyList"></div>
        </div>

        <div class="weather-section weather-section--theme-control">
          <div class="weather-theme-toggle-row">
            <div class="weather-theme-toggle-info">
              <span class="weather-theme-toggle-label">Weather-adaptive theme</span>
              <span class="weather-theme-toggle-desc">Subtly blend current conditions into your theme</span>
            </div>
            <button class="settings-toggle" id="weatherThemeToggle"></button>
          </div>
        </div>
      </div>

      <div class="weather-location-panel" id="weatherLocationPanel">
        <div class="weather-location-panel-header">
          <span>Set Location</span>
          <button class="weather-loc-cancel" id="weatherLocCancel">Cancel</button>
        </div>
        <div class="weather-loc-options">
          <button class="weather-loc-btn" id="weatherLocGPS">
            <span>📍</span>
            <div>
              <div class="weather-loc-btn-label">Use GPS</div>
              <div class="weather-loc-btn-sub">Detect automatically</div>
            </div>
          </button>
          <div class="weather-loc-search-wrap">
            <svg class="weather-loc-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input class="weather-loc-search" id="weatherLocSearch" type="text" placeholder="Search city…" autocomplete="off" spellcheck="false">
          </div>
          <div class="weather-loc-results" id="weatherLocResults"></div>
        </div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeWeatherPage(); });
  overlay.querySelector('#weatherCloseBtn')!.addEventListener('click', closeWeatherPage);

  overlay.querySelector('#weatherSetLocationBtn')!.addEventListener('click', () => {
    (overlay.querySelector('#weatherLocationPanel') as HTMLElement).classList.add('open');
  });
  overlay.querySelector('#weatherLocCancel')!.addEventListener('click', () => {
    (overlay.querySelector('#weatherLocationPanel') as HTMLElement).classList.remove('open');
  });

  // GPS
  overlay.querySelector('#weatherLocGPS')!.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    const btn = overlay.querySelector('#weatherLocGPS') as HTMLButtonElement;
    btn.innerHTML = '<span>⏳</span><div><div class="weather-loc-btn-label">Locating…</div><div class="weather-loc-btn-sub">Please wait</div></div>';
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`, { headers: { 'Accept-Language': 'en' } });
          const d = await res.json();
          const name = d?.address?.city || d?.address?.town || d?.address?.village || '';
          setManualLocation(lat, lon, name);
        } catch { setManualLocation(lat, lon); }
        (overlay.querySelector('#weatherLocationPanel') as HTMLElement).classList.remove('open');
        refreshWeather(overlay as HTMLElement);
      },
      () => {
        btn.innerHTML = '<span>📍</span><div><div class="weather-loc-btn-label">GPS denied</div><div class="weather-loc-btn-sub">Try manual search</div></div>';
      },
      { timeout: 10000 }
    );
  });

  // City search
  const searchInput = overlay.querySelector('#weatherLocSearch') as HTMLInputElement;
  let searchTimer = 0;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { (overlay.querySelector('#weatherLocResults') as HTMLElement).innerHTML = ''; return; }
    searchTimer = window.setTimeout(() => searchCity(q, overlay as HTMLElement), 400);
  });

  // Weather theme toggle
  const themeToggle = overlay.querySelector('#weatherThemeToggle') as HTMLButtonElement;
  const isEnabled = localStorage.getItem('sc_weather_theme') !== '0';
  themeToggle.classList.toggle('on', isEnabled);
  document.body.classList.toggle('weather-overlay-on', isEnabled);
  themeToggle.addEventListener('click', () => {
    const now = !themeToggle.classList.contains('on');
    themeToggle.classList.toggle('on', now);
    localStorage.setItem('sc_weather_theme', now ? '1' : '0');
    document.body.classList.toggle('weather-overlay-on', now);
    window.dispatchEvent(new CustomEvent('sc-weather-theme-toggle', { detail: { enabled: now } }));
  });

  return overlay;
}

async function searchCity(query: string, overlay: HTMLElement) {
  const results = overlay.querySelector('#weatherLocResults') as HTMLElement;
  results.innerHTML = '<div class="weather-loc-loading">Searching…</div>';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    results.innerHTML = '';
    if (!data.length) { results.innerHTML = '<div class="weather-loc-loading">No results found</div>'; return; }
    data.forEach((item: any) => {
      const name = item.address?.city || item.address?.town || item.address?.village || item.display_name.split(',')[0];
      const sub = [item.address?.state, item.address?.country].filter(Boolean).join(', ');
      const btn = document.createElement('button');
      btn.className = 'weather-loc-result';
      btn.innerHTML = `<span class="weather-loc-result-name">${name}</span><span class="weather-loc-result-sub">${sub}</span>`;
      btn.addEventListener('click', () => {
        setManualLocation(parseFloat(item.lat), parseFloat(item.lon), name);
        (overlay.querySelector('#weatherLocationPanel') as HTMLElement).classList.remove('open');
        refreshWeather(overlay);
      });
      results.appendChild(btn);
    });
  } catch {
    results.innerHTML = '<div class="weather-loc-loading">Search failed</div>';
  }
}

function refreshWeather(overlay: HTMLElement) {
  const iconEl = document.getElementById('weatherIcon');
  const textEl = document.getElementById('weatherText');
  const pillEl = document.getElementById('weatherPill');
  if (iconEl && textEl && pillEl) {
    initWeather(iconEl, textEl, pillEl, _privacyCheck, _onWeatherUpdate ?? undefined);
  }
  setTimeout(() => renderWeatherPage(overlay), 1800);
}

// ── Main render ────────────────────────────────────────────────────────
export function renderWeatherPage(overlay: HTMLElement) {
  const temp     = getCurrentTemp();
  const feels    = getFeelsLike();
  const wind     = getWind();
  const humidity = getHumidity();
  const desc     = getWeatherDesc();
  const overlayType = getWeatherOverlay();
  const stored   = getStoredLocation();
  const code     = getWeatherCode() ?? 0;

  // Location / time
  (overlay.querySelector('#weatherLocationName') as HTMLElement).textContent =
    stored?.name || (temp !== null ? 'Current location' : 'No location set');
  (overlay.querySelector('#weatherLocationTime') as HTMLElement).textContent =
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Background gradient
  const bg = overlay.querySelector('#weatherPageBg') as HTMLElement;
  bg.className = `weather-page-bg weather-bg-${overlayType}`;

  // Hero
  const iconEl  = overlay.querySelector('#weatherConditionIcon') as HTMLElement;
  const tempEl  = overlay.querySelector('#weatherHeroTemp') as HTMLElement;
  const descEl  = overlay.querySelector('#weatherHeroDesc') as HTMLElement;
  const feelsEl = overlay.querySelector('#weatherFeels') as HTMLElement;
  const windEl  = overlay.querySelector('#weatherWind') as HTMLElement;
  const humEl   = overlay.querySelector('#weatherHumidity') as HTMLElement;

  if (temp !== null) {
    const [icon] = getWMOInfo(code);
    iconEl.textContent  = icon;
    tempEl.textContent  = `${temp}°`;
    descEl.textContent  = desc;
    feelsEl.textContent = `Feels like ${feels}°`;
    windEl.textContent  = `${wind} km/h`;
    humEl.textContent   = `${humidity}%`;
  } else {
    iconEl.textContent = stored ? '⏳' : '📍';
    tempEl.textContent = '--°';
    descEl.textContent = stored ? 'Fetching weather…' : 'Tap "Set location" to begin';
  }

  // Particles
  const particles = overlay.querySelector('#weatherHeroParticles') as HTMLElement;
  particles.className = `weather-hero-particles weather-particles-${overlayType}`;

  renderHourly(overlay);
  renderSunArc(overlay);
  renderDaily(overlay);
}

function renderHourly(overlay: HTMLElement) {
  const strip = overlay.querySelector('#weatherHourlyStrip') as HTMLElement;
  strip.innerHTML = '';
  const forecast = getHourlyForecast();
  if (!forecast.length) { strip.innerHTML = '<div class="weather-hourly-empty">No forecast data — set a location to load</div>'; return; }
  forecast.slice(0, 24).forEach((h, i) => {
    const [icon] = getWMOInfo(h.code);
    const time = new Date(h.time);
    const label = i === 0 ? 'Now' : time.toLocaleTimeString([], { hour: 'numeric' });
    const item = document.createElement('div');
    item.className = 'weather-hourly-item';
    item.innerHTML = `<span class="weather-hourly-time">${label}</span><span class="weather-hourly-icon">${icon}</span><span class="weather-hourly-temp">${h.temp}°</span>`;
    strip.appendChild(item);
  });
}

function renderSunArc(overlay: HTMLElement) {
  const canvas = overlay.querySelector('#weatherSunCanvas') as HTMLCanvasElement;
  const sunTimesEl = overlay.querySelector('#weatherSunTimes') as HTMLElement;
  const sun = getSunTimes();
  if (!sun) { sunTimesEl.innerHTML = '<span>Set a location to see sunrise/sunset</span>'; return; }
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const toX = (mins: number) => (mins / 1440) * W;
  const riseX = toX(sun.rise), setX = toX(sun.set), midX = (riseX + setX) / 2;

  // Full arc (dim)
  ctx.beginPath(); ctx.moveTo(riseX, H - 8);
  ctx.quadraticCurveTo(midX, 8, setX, H - 8);
  ctx.strokeStyle = 'rgba(255,200,80,.2)'; ctx.lineWidth = 2; ctx.stroke();

  // Elapsed arc (bright)
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const pct = Math.max(0, Math.min(1, (nowMins - sun.rise) / (sun.set - sun.rise)));
  if (pct > 0 && pct <= 1) {
    const elapsedX = riseX + pct * (setX - riseX);
    const elapsedY = H - 8 - Math.sin(pct * Math.PI) * (H - 16);
    ctx.beginPath(); ctx.moveTo(riseX, H - 8);
    ctx.quadraticCurveTo(midX, 8, elapsedX, elapsedY);
    ctx.strokeStyle = 'rgba(255,200,80,.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    // Sun dot
    ctx.beginPath(); ctx.arc(elapsedX, elapsedY, 7, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(elapsedX, elapsedY, 0, elapsedX, elapsedY, 7);
    g.addColorStop(0, '#fff8c0'); g.addColorStop(1, '#ffb300');
    ctx.fillStyle = g; ctx.fill();
  }
  // Horizon
  ctx.beginPath(); ctx.moveTo(0, H - 8); ctx.lineTo(W, H - 8);
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke();

  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  sunTimesEl.innerHTML = `<span>🌅 ${fmt(Math.round(sun.rise))}</span><span>🌇 ${fmt(Math.round(sun.set))}</span>`;
}

function renderDaily(overlay: HTMLElement) {
  const list = overlay.querySelector('#weatherDailyList') as HTMLElement;
  list.innerHTML = '';
  const forecast = getDailyForecast();
  if (!forecast.length) return;
  const maxT = Math.max(...forecast.map(d => d.maxTemp));
  const minT = Math.min(...forecast.map(d => d.minTemp));
  const range = maxT - minT || 1;
  forecast.forEach((d, i) => {
    const [icon, desc] = getWMOInfo(d.code);
    const date = new Date(d.date + 'T12:00:00');
    const dayLabel = i === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
    const barLeft = ((d.minTemp - minT) / range) * 100;
    const barWidth = Math.max(((d.maxTemp - d.minTemp) / range) * 100, 8);
    const row = document.createElement('div');
    row.className = 'weather-daily-row';
    row.innerHTML = `
      <span class="weather-daily-day">${dayLabel}</span>
      <span class="weather-daily-icon" title="${desc}">${icon}</span>
      <div class="weather-daily-bar-wrap">
        <span class="weather-daily-min">${d.minTemp}°</span>
        <div class="weather-daily-bar"><div class="weather-daily-bar-fill" style="left:${barLeft.toFixed(1)}%;width:${barWidth.toFixed(1)}%"></div></div>
        <span class="weather-daily-max">${d.maxTemp}°</span>
      </div>`;
    list.appendChild(row);
  });
}

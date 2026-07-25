// Timeout helper for fetch(). Self-managed AbortController + timer, always
// cleared in `finally` so a timer never lingers after the request settles
// (the previous polyfill left a dangling setTimeout on every successful
// weather/geocode fetch — same leak pattern as timesync.ts).
async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const WMO: Record<number, [string, string]> = {
  0:['☀️','Clear'], 1:['🌤','Mostly clear'], 2:['⛅','Partly cloudy'], 3:['☁️','Overcast'],
  45:['🌫','Foggy'], 48:['🌫','Icy fog'],
  51:['🌦','Light drizzle'], 53:['🌦','Drizzle'], 55:['🌧','Heavy drizzle'],
  61:['🌧','Light rain'], 63:['🌧','Rain'], 65:['🌧','Heavy rain'],
  71:['🌨','Light snow'], 73:['🌨','Snow'], 75:['🌨','Heavy snow'],
  77:['🌨','Snow grains'], 85:['🌨','Light snow showers'], 86:['🌨','Heavy snow showers'],
  80:['🌦','Showers'], 81:['🌧','Rain showers'], 82:['🌧','Heavy showers'],
  95:['⛈','Thunderstorm'], 96:['⛈','Thunderstorm+hail'], 99:['⛈','Heavy thunderstorm'],
};

let refreshTimer = 0;

// ── Circadian sun math ────────────────────────────────────────────────
export function calcSunTimes(lat: number, lon: number): { rise: number; set: number; noon: number } {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const B = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const decl = 23.45 * Math.sin(B) * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const cosHa = -Math.tan(latRad) * Math.tan(decl);
  if (cosHa < -1) return { rise: 0, set: 1440, noon: 720 };
  if (cosHa >  1) return { rise: 720, set: 720, noon: 720 };
  const ha = Math.acos(cosHa) * 180 / Math.PI;
  const tzOffset = -now.getTimezoneOffset();
  const solarNoon = 720 - 4 * lon - eqTime + tzOffset;
  return {
    rise: solarNoon - 4 * ha,
    set:  solarNoon + 4 * ha,
    noon: solarNoon,
  };
}

export function getCircadianWarmth(sunTimes: { rise: number; set: number; noon: number }): number {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const { rise, set } = sunTimes;
  if (minuteOfDay < rise || minuteOfDay > set) return 1;
  if (minuteOfDay < rise + 90) return 1 - (minuteOfDay - rise) / 90;
  const setWindow = set - 90;
  if (minuteOfDay < setWindow) return 0;
  return (minuteOfDay - setWindow) / 90;
}

// Stored for external access
let sunTimes: { rise: number; set: number; noon: number } | null = null;
let _currentWeatherCode: number | null = null;
let _currentTemp: number | null = null;
let _currentLocation: { lat: number; lon: number; name?: string } | null = null;
let _currentWeatherDesc: string = '';
let _currentFeelsLike: number | null = null;
let _currentWind: number | null = null;
let _currentHumidity: number | null = null;
let _hourlyForecast: Array<{ time: string; temp: number; code: number }> = [];
let _dailyForecast: Array<{ date: string; minTemp: number; maxTemp: number; code: number }> = [];

export function getSunTimes() { return sunTimes; }
export function getWeatherCode() { return _currentWeatherCode; }
export function getCurrentTemp() { return _currentTemp; }
export function getCurrentLocation() { return _currentLocation; }
export function getWeatherDesc() { return _currentWeatherDesc; }
export function getFeelsLike() { return _currentFeelsLike; }
export function getWind() { return _currentWind; }
export function getHumidity() { return _currentHumidity; }
export function getHourlyForecast() { return _hourlyForecast; }
export function getDailyForecast() { return _dailyForecast; }

export function isRaining(): boolean {
  if (_currentWeatherCode === null) return false;
  return (_currentWeatherCode >= 51 && _currentWeatherCode <= 67)
      || (_currentWeatherCode >= 80 && _currentWeatherCode <= 82)
      || (_currentWeatherCode >= 95 && _currentWeatherCode <= 99);
}
export function isSnowing(): boolean {
  if (_currentWeatherCode === null) return false;
  return (_currentWeatherCode >= 71 && _currentWeatherCode <= 77) || _currentWeatherCode === 85 || _currentWeatherCode === 86;
}
export function isClear(): boolean {
  if (_currentWeatherCode === null) return false;
  return _currentWeatherCode <= 3;
}
export function isThunderstorm(): boolean {
  if (_currentWeatherCode === null) return false;
  return _currentWeatherCode >= 95;
}
export function isFoggy(): boolean {
  if (_currentWeatherCode === null) return false;
  return _currentWeatherCode === 45 || _currentWeatherCode === 48;
}
export function isOvercast(): boolean {
  if (_currentWeatherCode === null) return false;
  return _currentWeatherCode === 3;
}

// Weather condition category for dynamic theme overlay
export type WeatherOverlay = 'clear' | 'rain' | 'snow' | 'thunder' | 'fog' | 'cloudy' | 'none';
export function getWeatherOverlay(): WeatherOverlay {
  if (_currentWeatherCode === null) return 'none';
  if (isThunderstorm()) return 'thunder';
  if (isSnowing()) return 'snow';
  if (isRaining()) return 'rain';
  if (isFoggy()) return 'fog';
  if (isOvercast()) return 'cloudy';
  if (isClear()) return 'clear';
  return 'none';
}

// ── Reverse geocode city name ─────────────────────────────────────────
export async function getCityName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`,
      6000,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || '';
  } catch {
    return '';
  }
}

// ── Main weather fetch ─────────────────────────────────────────────────
async function fetchWeatherData(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m`
    + `&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min`
    + `&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto&forecast_days=7`;
  const res = await fetchWithTimeout(url, 10000);
  if (!res.ok) throw new Error(`Weather API error ${res.status}`);
  const data = await res.json();
  if (!data?.current) throw new Error('Weather API returned no current conditions');
  return data;
}

// One retry after a short delay — most "unavailable" reports are a single
// transient network blip, not a real outage, so don't give up immediately.
async function fetchWeatherDataWithRetry(lat: number, lon: number) {
  try {
    return await fetchWeatherData(lat, lon);
  } catch {
    await new Promise(r => setTimeout(r, 1200));
    return fetchWeatherData(lat, lon);
  }
}

// Set location manually (from weather page UI)
export function setManualLocation(lat: number, lon: number, name?: string) {
  _currentLocation = { lat, lon, name };
  // Round to ~1 decimal place (~11km) before persisting — enough for
  // city-level forecast accuracy without keeping an exact address-level
  // GPS fix in clear text in localStorage.
  const lat1 = Math.round(lat * 10) / 10;
  const lon1 = Math.round(lon * 10) / 10;
  localStorage.setItem('sc_weather_loc', JSON.stringify({ lat: lat1, lon: lon1, name }));
}

export function getStoredLocation(): { lat: number; lon: number; name?: string } | null {
  try {
    const stored = localStorage.getItem('sc_weather_loc');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Reject anything that isn't a real coordinate pair — this also
    // self-heals entries from the earlier bug where only {name} was saved.
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lon !== 'number') {
      localStorage.removeItem('sc_weather_loc');
      return null;
    }
    return { lat: parsed.lat, lon: parsed.lon, name: parsed.name };
  } catch { return null; }
}

export async function initWeather(
  iconEl: HTMLElement,
  textEl: HTMLElement,
  pillEl: HTMLElement,
  privacyCheck: () => boolean = () => false,
  onUpdate?: (code: number, temp: number, desc: string) => void,
) {
  if (privacyCheck()) return;

  const show = (icon: string | null, text: string, title = '') => {
    if (icon) iconEl.textContent = icon;
    textEl.textContent = text;
    if (title) pillEl.title = title;
    pillEl.classList.add('loaded');
  };

  const processWeather = async (lat: number, lon: number) => {
    if (privacyCheck()) return;
    sunTimes = calcSunTimes(lat, lon);
    (window as any).__scLat = lat;
    _currentLocation = { lat, lon, name: _currentLocation?.name };
    _lastFetchFailed = false;

    try {
      const data = await fetchWeatherDataWithRetry(lat, lon);
      const cur = data.current;
      _currentWeatherCode = cur.weathercode as number;
      _currentTemp = Math.round(cur.temperature_2m);
      _currentFeelsLike = Math.round(cur.apparent_temperature);
      _currentWind = Math.round(cur.windspeed_10m);
      _currentHumidity = Math.round(cur.relativehumidity_2m ?? 0);

      const [icon, desc] = WMO[cur.weathercode as number] ?? ['🌡', 'Unknown'];
      _currentWeatherDesc = desc;

      // Parse hourly (next 24h)
      const nowIdx = data.hourly?.time?.findIndex((t: string) => new Date(t) > new Date()) ?? 0;
      _hourlyForecast = (data.hourly?.time ?? []).slice(nowIdx, nowIdx + 24).map((t: string, i: number) => ({
        time: t,
        temp: Math.round(data.hourly.temperature_2m[nowIdx + i]),
        code: data.hourly.weathercode[nowIdx + i],
      }));

      // Parse daily (7 days)
      _dailyForecast = (data.daily?.time ?? []).map((t: string, i: number) => ({
        date: t,
        minTemp: Math.round(data.daily.temperature_2m_min[i]),
        maxTemp: Math.round(data.daily.temperature_2m_max[i]),
        code: data.daily.weathercode[i],
      }));

      show(icon, `${_currentTemp}°`, `${desc} · Feels ${_currentFeelsLike}° · Wind ${_currentWind} km/h`);
      onUpdate?.(_currentWeatherCode, _currentTemp, desc);

      // Apply dynamic weather overlay to body
      applyWeatherBodyClass(getWeatherOverlay());

    } catch {
      _lastFetchFailed = true;
      show(null, '—', 'Weather unavailable');
    }
  };

  const fetchWeather = () => {
    if (privacyCheck()) return;

    // Only use a location the user explicitly chose (GPS button or city
    // search inside the weather page — see weatherpage.ts). We never call
    // navigator.geolocation here: doing so used to fire the browser's
    // permission popup the moment the site loaded, before the user had
    // asked for weather at all. If nothing's set yet, just show a neutral
    // "tap to set location" state.
    const stored = getStoredLocation();
    if (stored) {
      processWeather(stored.lat, stored.lon);
    } else {
      show(null, 'Set location', 'Tap to choose your location for weather');
    }
  };

  fetchWeather();
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!privacyCheck()) fetchWeather();
  }, 15 * 60_000);
}

let _lastFetchFailed = false;
export function didWeatherFail() { return _lastFetchFailed; }

export function stopWeather() {
  clearInterval(refreshTimer);
}

// ── Dynamic weather body classes ──────────────────────────────────────
function applyWeatherBodyClass(overlay: WeatherOverlay) {
  const all: WeatherOverlay[] = ['clear','rain','snow','thunder','fog','cloudy'];
  all.forEach(c => document.body.classList.remove(`weather-${c}`));
  if (overlay !== 'none') document.body.classList.add(`weather-${overlay}`);
  // Dispatch event so weather page can react
  window.dispatchEvent(new CustomEvent('sc-weather-update', { detail: { overlay } }));
}

// ── WMO lookup helper ─────────────────────────────────────────────────
export function getWMOInfo(code: number): [string, string] {
  return WMO[code] ?? ['🌡', 'Unknown'];
}

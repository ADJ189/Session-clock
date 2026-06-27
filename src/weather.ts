// Polyfill AbortSignal.timeout for Safari < 16.4 and Firefox < 100
function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
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
async function getCityName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`,
      { signal: abortAfter(6000), headers: { 'Accept-Language': 'en' } }
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
  const res = await fetch(url, { signal: abortAfter(10000) });
  return await res.json();
}

// Set location manually (from weather page UI)
export function setManualLocation(lat: number, lon: number, name?: string) {
  _currentLocation = { lat, lon, name };
  localStorage.setItem('sc_weather_loc', JSON.stringify({ lat, lon, name }));
}

export function getStoredLocation(): { lat: number; lon: number; name?: string } | null {
  try {
    const stored = localStorage.getItem('sc_weather_loc');
    return stored ? JSON.parse(stored) : null;
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

  const show = (icon: string, text: string, title = '') => {
    iconEl.textContent = icon;
    textEl.textContent = text;
    if (title) pillEl.title = title;
    pillEl.classList.add('loaded');
  };

  const processWeather = async (lat: number, lon: number) => {
    if (privacyCheck()) return;
    sunTimes = calcSunTimes(lat, lon);
    (window as any).__scLat = lat;
    _currentLocation = { lat, lon, name: _currentLocation?.name };

    try {
      const data = await fetchWeatherData(lat, lon);
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
      show('🌡', '—', 'Weather unavailable');
    }
  };

  const fetchWeather = () => {
    if (privacyCheck()) return;

    // Check stored location first (manual pin or previously granted)
    const stored = getStoredLocation();
    if (stored) {
      processWeather(stored.lat, stored.lon);
      return;
    }

    if (!navigator.geolocation) { return; }

    // Try geolocation silently — if denied, no popup or error shown
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        const name = await getCityName(lat, lon);
        _currentLocation = { lat, lon, name };
        localStorage.setItem('sc_weather_loc', JSON.stringify({ lat, lon, name }));
        processWeather(lat, lon);
      },
      () => {
        // Denied — will remain without weather until user sets location in weather page
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  fetchWeather();
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!privacyCheck()) fetchWeather();
  }, 15 * 60_000);
}

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

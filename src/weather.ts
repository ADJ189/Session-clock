const WMO: Record<number, [string, string]> = {
  0:['☀️','Clear'], 1:['🌤','Mostly clear'], 2:['⛅','Partly cloudy'], 3:['☁️','Overcast'],
  45:['🌫','Foggy'], 48:['🌫','Icy fog'],
  51:['🌦','Light drizzle'], 53:['🌦','Drizzle'], 55:['🌧','Heavy drizzle'],
  61:['🌧','Light rain'], 63:['🌧','Rain'], 65:['🌧','Heavy rain'],
  71:['🌨','Light snow'], 73:['🌨','Snow'], 75:['🌨','Heavy snow'],
  80:['🌦','Showers'], 81:['🌧','Rain showers'], 82:['🌧','Heavy showers'],
  95:['⛈','Thunderstorm'], 96:['⛈','Thunderstorm+hail'], 99:['⛈','Heavy thunderstorm'],
};

let refreshTimer = 0;

// ── Circadian sun math ────────────────────────────────────────────────
// Returns sunrise and sunset as minutes-since-midnight (local time)
// NOAA-based approximation. Accurate to ±2 min.
export function calcSunTimes(lat: number, lon: number): { rise: number; set: number; noon: number } {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const B = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  const decl = 23.45 * Math.sin(B) * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const cosHa = -Math.tan(latRad) * Math.tan(decl);
  if (cosHa < -1) return { rise: 0, set: 1440, noon: 720 }; // midnight sun
  if (cosHa >  1) return { rise: 720, set: 720, noon: 720 }; // polar night
  const ha = Math.acos(cosHa) * 180 / Math.PI; // hour angle in degrees
  const tzOffset = -now.getTimezoneOffset(); // minutes
  const solarNoon = 720 - 4 * lon - eqTime + tzOffset;
  return {
    rise: solarNoon - 4 * ha,
    set:  solarNoon + 4 * ha,
    noon: solarNoon,
  };
}

// 0 = cool blue (night/dawn), 1 = warm amber (dusk/evening)
export function getCircadianWarmth(sunTimes: { rise: number; set: number; noon: number }): number {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const { rise, set } = sunTimes;

  // Before sunrise or after sunset → warm amber (low blue light)
  if (minuteOfDay < rise || minuteOfDay > set) return 1;

  // Sunrise window (rise to rise+90 min): ramp 1→0
  if (minuteOfDay < rise + 90) return 1 - (minuteOfDay - rise) / 90;

  // Midday window (cool, neutral): 0
  const setWindow = set - 90;
  if (minuteOfDay < setWindow) return 0;

  // Sunset window (setWindow to set): ramp 0→1
  return (minuteOfDay - setWindow) / 90;
}

// Stored for external access
let sunTimes: { rise: number; set: number; noon: number } | null = null;
let _currentWeatherCode: number | null = null;
export function getSunTimes() { return sunTimes; }
export function getWeatherCode() { return _currentWeatherCode; }
export function isRaining(): boolean {
  if (_currentWeatherCode === null) return false;
  // WMO codes 51–67 = drizzle/rain, 80–82 = showers, 95–99 = thunderstorm
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

export async function initWeather(
  iconEl: HTMLElement,
  textEl: HTMLElement,
  pillEl: HTMLElement,
  privacyCheck: () => boolean = () => false,
) {
  if (privacyCheck()) return;

  const show = (icon: string, text: string, title = '') => {
    iconEl.textContent = icon;
    textEl.textContent = text;
    if (title) pillEl.title = title;
    pillEl.classList.add('loaded');
  };

  const fetchWeather = () => {
    if (privacyCheck()) return;
    if (!navigator.geolocation) { show('🌡', '—', 'No geolocation'); return; }

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        // Compute sun times immediately from coords — no extra fetch needed
        sunTimes = calcSunTimes(lat, lon);
        (window as any).__scLat = lat; // expose for sidereal time easter egg

        try {
          const url = `https://api.open-meteo.com/v1/forecast`
            + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
            + `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m`
            + `&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const data = await res.json();
          const cur = data.current;
          _currentWeatherCode = cur.weathercode as number;
          const [icon, desc] = WMO[cur.weathercode as number] ?? ['🌡', 'Unknown'];
          const temp = Math.round(cur.temperature_2m);
          const feels = Math.round(cur.apparent_temperature);
          const wind = Math.round(cur.windspeed_10m);
          show(icon, `${temp}°`, `${desc} · Feels ${feels}° · Wind ${wind} km/h`);
        } catch {
          show('🌡', '—', 'Weather unavailable');
        }
      },
      () => show('🌡', '—', 'Location denied'),
      { timeout: 10000, maximumAge: 300_000 },
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

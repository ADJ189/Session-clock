/** Zero-pad to 2 digits */
export const p2 = (n: number) => (n < 10 ? '0' : '') + n;
/** Zero-pad to 3 digits */
export const p3 = (n: number) => (n < 10 ? '00' : n < 100 ? '0' : '') + n;
/** Random [0, n) */
export const rnd = (n: number) => Math.random() * n;
/** Random [-n, n] */
export const rndpm = (n: number) => (Math.random() - 0.5) * n * 2;
/** Ease in-out */
export const easeIO = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;

/** Format ms as HH:MM:SS */
export function fmtSession(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${p2(h)}:${p2(m)}:${p2(sc)}`;
}

export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const GREETS: [number, number, string][] = [
  [0, 5, '🌙 Good Night'], [5, 12, '☀️ Good Morning'],
  [12, 17, '🌤️ Good Afternoon'], [17, 21, '🌆 Good Evening'], [21, 24, '🌙 Good Night'],
];

/** MAT_CHARS for Matrix rain */
export const MAT_CHARS = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01';


/** Estimated localStorage usage in bytes (UTF-16, ~2 bytes/char, keys +
 *  values). `JSON.stringify(localStorage)` isn't a reliable way to measure
 *  this — a Storage object doesn't serialize its entries that way across
 *  browsers, so it often reports ~2 ("{}"). */
export function localStorageBytes(): number {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k == null) continue;
    chars += k.length + (localStorage.getItem(k)?.length ?? 0);
  }
  return chars * 2;
}


/** fetch() that aborts after `ms` so a stalled provider can't leave a UI in
 *  "loading…" forever or pin an in-flight guard open. Self-managed
 *  AbortController + timer (not AbortSignal.timeout, which needs
 *  Safari 16+ / Chrome 103+ — this repo's build targets go older). If the
 *  caller passes its own `signal`, aborting it also aborts this request. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

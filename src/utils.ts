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

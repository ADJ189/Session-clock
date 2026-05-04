import type { SyncResult } from './types';

// Polyfill AbortSignal.timeout for Safari < 16.4 and Firefox < 100
function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

const CF_ENDPOINTS = [
  'https://cloudflare.com/cdn-cgi/trace',
  'https://1.1.1.1/cdn-cgi/trace',
  'https://one.one.one.one/cdn-cgi/trace',
];
const FALLBACK = 'https://worldtimeapi.org/api/ip';
const SYNC_INTERVAL = 15 * 60 * 1000;

export let clockOffset = 0;
export let synced = false;

type SyncStateHandler = (state: 'syncing' | 'ok' | 'failed', rtt?: number) => void;
let onStateChange: SyncStateHandler = () => {};
let syncTimer = 0;

export function setSyncHandler(fn: SyncStateHandler) { onStateChange = fn; }

async function probe(url: string, ms: number): Promise<SyncResult | null> {
  try {
    const t0 = performance.now();
    const res = await fetch(url, { cache: 'no-store', signal: abortAfter(ms) });
    const rtt = performance.now() - t0;
    const ds = res.headers.get('date');
    if (!ds) return null;
    res.text().catch(() => {});
    return { offset: new Date(ds).getTime() - (Date.now() - rtt / 2), rtt };
  } catch { return null; }
}

async function multiProbe(url: string, n = 3): Promise<SyncResult | null> {
  const results: SyncResult[] = [];
  for (let i = 0; i < n; i++) {
    const r = await probe(url, 2500);
    if (r) results.push(r);
    if (i < n - 1) await new Promise(res => setTimeout(res, 80));
  }
  if (!results.length) return null;
  return results.sort((a, b) => a.rtt - b.rtt)[0] ?? null;
}

export async function syncTime(): Promise<void> {
  onStateChange('syncing');
  const cfResults = await Promise.all(CF_ENDPOINTS.map(u => multiProbe(u)));
  let best: SyncResult | null = null;
  for (const r of cfResults) {
    if (r && (!best || r.rtt < best.rtt)) best = r;
  }
  if (!best) {
    try {
      const t0 = performance.now();
      const res = await fetch(FALLBACK, { cache: 'no-store', signal: abortAfter(5000) });
      const rtt = performance.now() - t0;
      const d = await res.json();
      best = { offset: new Date(d.datetime).getTime() - (Date.now() - rtt / 2), rtt };
    } catch {}
  }
  if (!best) {
    onStateChange('failed');
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncTime, synced ? SYNC_INTERVAL : 60_000);
    return;
  }
  clockOffset = best.offset;
  synced = true;
  onStateChange('ok', best.rtt);
  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncTime, SYNC_INTERVAL);
}

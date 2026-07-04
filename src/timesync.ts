import type { SyncResult } from './types';

// Timeout helper for fetch(). We manage our own AbortController + timer
// (rather than relying solely on AbortSignal.timeout, which needs Safari
// 16.4+ / Firefox 100+ and this app targets Safari 14+ / Firefox 78+) and
// always clear the timer in `finally` so it never leaks — the previous
// version left a dangling setTimeout on every successful sync.
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
    const res = await fetchWithTimeout(url, ms);
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
      const res = await fetchWithTimeout(FALLBACK, 5000);
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

/// <reference lib="webworker" />

/**
 * Off-main-thread history processing. Deliberately NOT used for every
 * history read — see library/history.ts, which only dispatches here once
 * the row count crosses a threshold. For a few dozen rows, a direct
 * main-thread reduce is faster than the postMessage round-trip; this only
 * earns its keep once a long-lived listener has hundreds/thousands of
 * history rows to fold into a distinct, most-recent-first track list.
 */

export interface DedupeHistoryRequest {
  requestId: number;
  rows: { trackId: string; playedAt: number }[];
  limit: number;
}

export interface DedupeHistoryResponse {
  requestId: number;
  trackIds: string[];
}

self.onmessage = (e: MessageEvent<DedupeHistoryRequest>) => {
  const { requestId, rows, limit } = e.data;
  const seen = new Set<string>();
  const ordered: string[] = [];
  // rows arrive newest-first (see history.ts's query) so the first time we
  // see a trackId is its most recent play.
  for (const row of rows) {
    if (seen.has(row.trackId)) continue;
    seen.add(row.trackId);
    ordered.push(row.trackId);
    if (ordered.length >= limit) break;
  }
  const response: DedupeHistoryResponse = { requestId, trackIds: ordered };
  (self as unknown as Worker).postMessage(response);
};

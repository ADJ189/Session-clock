// ── Live GitHub repo stats ──────────────────────────────────────────────
// Small, opt-in-only fetch used purely to make the GitHub support box feel
// alive (real star/fork counts) instead of static copy. Uses the
// unauthenticated public GitHub REST API (no token, generous rate limit),
// cached in sessionStorage for an hour so re-opening the modal repeatedly
// in one visit never re-hits the network. Fails silently — the modal
// already reads fine with no numbers at all, so a network error, rate
// limit, or offline Privacy Mode session just falls back to hiding the
// stat row rather than showing an error state.

const REPO = 'ADJ189/Session-clock';
const CACHE_KEY = 'sc_gh_stats_cache_v1';
const CACHE_MS = 60 * 60 * 1000; // 1 hour

export interface RepoStats {
  stars: number;
  forks: number;
}

interface CacheShape { t: number; stats: RepoStats }

export async function fetchRepoStats(): Promise<RepoStats | null> {
  // Respect Privacy Mode — never make a network request when it's on.
  if (localStorage.getItem('sc_privacy') === '1') return null;

  try {
    const cachedRaw = sessionStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as CacheShape;
      if (Date.now() - cached.t < CACHE_MS) return cached.stats;
    }
  } catch { /* corrupt cache entry — ignore and refetch */ }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number; forks_count?: number };
    if (typeof data.stargazers_count !== 'number') return null;
    const stats: RepoStats = {
      stars: data.stargazers_count,
      forks: data.forks_count ?? 0,
    };
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), stats } satisfies CacheShape));
    } catch { /* storage full/blocked — non-fatal */ }
    return stats;
  } catch {
    return null; // offline, blocked, or rate-limited — the modal reads fine without it
  }
}

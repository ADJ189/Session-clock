// Fault-tolerant localStorage helpers.
//
// Anything that runs during boot (module evaluation or init()) must never be
// able to throw because of storage: the Storage API can throw when storage is
// blocked (privacy modes, embedded webviews, disabled cookies), when the quota
// is exceeded, and JSON.parse throws on any corrupted value. A throw at that
// point aborts startup and leaves a half-initialised app, so every read of
// persisted state should go through these helpers and fall back to a default.

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Reads and JSON-parses `key`. Missing, unreadable or malformed values yield `fallback`. */
export function safeJsonGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON-stringifies and stores `value`. Returns false if it could not be saved. */
export function safeJsonSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

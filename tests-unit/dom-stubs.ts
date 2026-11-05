// The smallest browser surface `src/platform.ts` reads at module load. Only
// needed by tests that import an app module (sound.ts) rather than a pure
// audio/utility module. Everything is a no-op stub; no test asserts on DOM
// behaviour here.
export function installDomStubs(): void {
  const g = globalThis as unknown as Record<string, unknown>;

  if (!g.window) g.window = globalThis;

  // Deno's `globalThis` is an EventTarget, Node's is not. `src/platform.ts`
  // attaches its 'deviceorientation' listener lazily on first subscriber, so
  // the stub needs the EventTarget surface regardless of runtime.
  if (typeof g.addEventListener !== "function") {
    g.addEventListener = () => {};
    g.removeEventListener = () => {};
    g.dispatchEvent = () => false;
  }

  if (!g.matchMedia) {
    g.matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }

  if (!g.CSS) {
    g.CSS = { supports: () => false };
  }

  if (!g.document) {
    const defaultEl = {
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      remove() {},
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
      canPlayType: () => "",
    };
    g.document = {
      documentElement: defaultEl,
      head: defaultEl,
      body: defaultEl,
      createElement: () => ({ ...defaultEl }),
      getElementById: () => null,
      addEventListener() {},
      removeEventListener() {},
    };
  }

  // Always install a fresh in-memory store. A runtime may ship a persistent
  // `localStorage` whose accessor ignores plain assignment, so a key written
  // by an earlier test (for example `sc_spatial=1`) would leak into the next
  // run and make "defaults" tests depend on machine history. Define the
  // property directly; fall back to clearing the runtime store if the
  // definition is rejected.
  const data = new Map<string, string>();
  const store = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, String(value)),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  try {
    Object.defineProperty(g, "localStorage", {
      configurable: true,
      enumerable: true,
      value: store,
    });
  } catch {
    g.localStorage = store;
  }
  try {
    // The identifier can still resolve to the runtime's accessor in some scopes.
    localStorage.clear();
  } catch {
    // Already replaced by the in-memory store.
  }
}

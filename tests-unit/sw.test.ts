import { test } from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

interface ServiceWorkerCore {
  CACHE_PREFIX: string;
  BUILD_PLACEHOLDER: string;
  normalizeVersion(version: unknown): string;
  cacheNameFor(version: unknown): string;
  isSessionClockCache(key: unknown): boolean;
  shouldDeleteCache(key: unknown, current: string): boolean;
  parseBuildVersion(source: string): string;
  isCacheableExternal(host: string, allowlist: Set<string> | string[]): boolean;
  isCacheableResponse(res: { ok?: boolean; type?: string } | null): boolean;
  isCacheableRequest(req: {
    method?: string;
    headers?: { has(name: string): boolean };
  } | null): boolean;
}

// The worker loads this file with importScripts(); in Node the same classic
// script attaches its helpers to globalThis when imported for its side effect.
// It is plain JavaScript, so there is no declaration file to resolve.
// @ts-expect-error side-effect import of the classic worker core
await import("../public/sw-core.js");
const core = (globalThis as unknown as { ScSWCore: ServiceWorkerCore }).ScSWCore;

test("cache names are derived from a normalised build version", () => {
  assert.strictEqual(core.cacheNameFor("__SC_BUILD_VERSION__"), "session-clock-dev");
  assert.strictEqual(core.cacheNameFor(""), "session-clock-dev");
  assert.strictEqual(core.cacheNameFor(null), "session-clock-dev");
  assert.strictEqual(core.cacheNameFor("  ABC-123  "), "session-clock-abc-123");
  assert.strictEqual(core.cacheNameFor("a b/c"), "session-clock-abc");
  assert.strictEqual(
    core.cacheNameFor("x".repeat(80)).length,
    "session-clock-".length + 40,
  );
});

test("only this app's cache generations are touched", () => {
  assert.strictEqual(core.isSessionClockCache("session-clock-dev"), true);
  assert.strictEqual(core.isSessionClockCache("session-clock-abc"), true);
  assert.strictEqual(core.isSessionClockCache("other-app-v1"), false);
  assert.strictEqual(core.isSessionClockCache(null), false);
  assert.strictEqual(core.shouldDeleteCache("session-clock-old", "session-clock-new"), true);
  assert.strictEqual(core.shouldDeleteCache("session-clock-new", "session-clock-new"), false);
  assert.strictEqual(core.shouldDeleteCache("other", "session-clock-new"), false);
});

test("the build stamp parser finds a stamped comment line", () => {
  assert.strictEqual(core.parseBuildVersion("// build:20250101abc\n"), "20250101abc");
  assert.strictEqual(core.parseBuildVersion("// BUILD:abc.123\n"), "abc.123");
  assert.strictEqual(core.parseBuildVersion("const x = 1;\n// build:abc"), "abc");
  assert.strictEqual(core.parseBuildVersion("const build = 'abc';"), "");
  assert.strictEqual(core.parseBuildVersion(""), "");
});

test("external hosts are checked against a Set or an array", () => {
  const set = new Set(["cdn.jsdelivr.net", "fonts.gstatic.com"]);
  assert.strictEqual(core.isCacheableExternal("cdn.jsdelivr.net", set), true);
  assert.strictEqual(core.isCacheableExternal("evil.example", set), false);
  assert.strictEqual(
    core.isCacheableExternal("fonts.gstatic.com", ["fonts.gstatic.com"]),
    true,
  );
  assert.strictEqual(core.isCacheableExternal("", set), false);
});

test("only successful basic/cors responses are persisted", () => {
  assert.strictEqual(core.isCacheableResponse({ ok: true, type: "basic" }), true);
  assert.strictEqual(core.isCacheableResponse({ ok: true, type: "cors" }), true);
  assert.strictEqual(core.isCacheableResponse({ ok: false, type: "basic" }), false);
  assert.strictEqual(core.isCacheableResponse({ ok: true, type: "opaque" }), false);
  assert.strictEqual(core.isCacheableResponse(null), false);
});

test("requests are GET/HEAD and never carry authorization", () => {
  assert.strictEqual(core.isCacheableRequest({ method: "GET" }), true);
  assert.strictEqual(core.isCacheableRequest({ method: "HEAD" }), true);
  assert.strictEqual(core.isCacheableRequest({ method: "POST" }), false);
  assert.strictEqual(core.isCacheableRequest(null), false);
  assert.strictEqual(
    core.isCacheableRequest({
      method: "GET",
      headers: new Headers({ authorization: "Bearer secret" }),
    }),
    false,
  );
});

test("the worker source is wired to the shared core", async () => {
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
  );
  assert.strictEqual(source.includes('importScripts("/sw-core.js")'), true);
  assert.strictEqual(source.includes("__SC_BUILD_VERSION__"), true);
  assert.strictEqual(source.includes("CORE.shouldDeleteCache"), true);
  assert.strictEqual(source.includes("CORE.isCacheableRequest"), true);
});

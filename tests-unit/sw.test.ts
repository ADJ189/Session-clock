import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertEquals } from "./assert.ts";

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
  assertEquals(core.cacheNameFor("__SC_BUILD_VERSION__"), "session-clock-dev");
  assertEquals(core.cacheNameFor(""), "session-clock-dev");
  assertEquals(core.cacheNameFor(null), "session-clock-dev");
  assertEquals(core.cacheNameFor("  ABC-123  "), "session-clock-abc-123");
  assertEquals(core.cacheNameFor("a b/c"), "session-clock-abc");
  assertEquals(
    core.cacheNameFor("x".repeat(80)).length,
    "session-clock-".length + 40,
  );
});

test("only this app's cache generations are touched", () => {
  assertEquals(core.isSessionClockCache("session-clock-dev"), true);
  assertEquals(core.isSessionClockCache("session-clock-abc"), true);
  assertEquals(core.isSessionClockCache("other-app-v1"), false);
  assertEquals(core.isSessionClockCache(null), false);
  assertEquals(core.shouldDeleteCache("session-clock-old", "session-clock-new"), true);
  assertEquals(core.shouldDeleteCache("session-clock-new", "session-clock-new"), false);
  assertEquals(core.shouldDeleteCache("other", "session-clock-new"), false);
});

test("the build stamp parser finds a stamped comment line", () => {
  assertEquals(core.parseBuildVersion("// build:20250101abc\n"), "20250101abc");
  assertEquals(core.parseBuildVersion("// BUILD:abc.123\n"), "abc.123");
  assertEquals(core.parseBuildVersion("const x = 1;\n// build:abc"), "abc");
  assertEquals(core.parseBuildVersion("const build = 'abc';"), "");
  assertEquals(core.parseBuildVersion(""), "");
});

test("external hosts are checked against a Set or an array", () => {
  const set = new Set(["cdn.jsdelivr.net", "fonts.gstatic.com"]);
  assertEquals(core.isCacheableExternal("cdn.jsdelivr.net", set), true);
  assertEquals(core.isCacheableExternal("evil.example", set), false);
  assertEquals(
    core.isCacheableExternal("fonts.gstatic.com", ["fonts.gstatic.com"]),
    true,
  );
  assertEquals(core.isCacheableExternal("", set), false);
});

test("only successful basic/cors responses are persisted", () => {
  assertEquals(core.isCacheableResponse({ ok: true, type: "basic" }), true);
  assertEquals(core.isCacheableResponse({ ok: true, type: "cors" }), true);
  assertEquals(core.isCacheableResponse({ ok: false, type: "basic" }), false);
  assertEquals(core.isCacheableResponse({ ok: true, type: "opaque" }), false);
  assertEquals(core.isCacheableResponse(null), false);
});

test("requests are GET/HEAD and never carry authorization", () => {
  assertEquals(core.isCacheableRequest({ method: "GET" }), true);
  assertEquals(core.isCacheableRequest({ method: "HEAD" }), true);
  assertEquals(core.isCacheableRequest({ method: "POST" }), false);
  assertEquals(core.isCacheableRequest(null), false);
  assertEquals(
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
  assertEquals(source.includes('importScripts("/sw-core.js")'), true);
  assertEquals(source.includes("__SC_BUILD_VERSION__"), true);
  assertEquals(source.includes("CORE.shouldDeleteCache"), true);
  assertEquals(source.includes("CORE.isCacheableRequest"), true);
});

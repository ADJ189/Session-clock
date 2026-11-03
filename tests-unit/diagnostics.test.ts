import { test } from "node:test";
import {
  assertEquals,
  assert,
  assertMatch,
  assertNotMatch,
} from "./assert.ts";
import {
  DiagnosticsStore,
  formatDiagnostics,
  sanitizeDetails,
  sanitizeText,
  sanitizeUrl,
} from "../src/diagnostics.ts";

test("sanitizeUrl drops credentials, query and fragment", () => {
  assertEquals(
    sanitizeUrl("https://user:secret@example.com/path?token=abc#frag"),
    "https://example.com/path",
  );
  assertEquals(sanitizeUrl("https://example.com/a?b=1#c"), "https://example.com/a");
  assertEquals(sanitizeUrl("not a url?secret=1#x"), "not a url");
  assertEquals(sanitizeUrl(""), "");
});

test("sanitizeText redacts common secret shapes", () => {
  const bearer = sanitizeText("Authorization: Bearer abc.def.ghi");
  assertNotMatch(bearer, /abc\.def\.ghi/);
  assertMatch(bearer, /\[redacted\]/);

  const token = sanitizeText("token=super-secret-value");
  assertNotMatch(token, /super-secret-value/);
  assertMatch(token, /\[redacted\]/);

  const gh = sanitizeText("failed with ghp_ABCDEFGHIJKLMNOPQRSTUV123456");
  assertNotMatch(gh, /ghp_/);

  const sk = sanitizeText("key sk-abcdefghijklmnopqrstuvwx");
  assertNotMatch(sk, /sk-abcdefghijklmnopqrstuvwx/);
});

test("sanitizeText strips query strings from embedded URLs", () => {
  const text = sanitizeText(
    "GET https://example.com/api?access_token=leak failed",
  );
  assertEquals(text.includes("leak"), false);
  assert(text.includes("https://example.com/api"));
});

test("sanitizeText normalises whitespace and caps length", () => {
  assertEquals(sanitizeText("  a \n\n b\t c  "), "a b c");
  const long = sanitizeText("x".repeat(500), 10);
  assertEquals(long.length, 11);
  assert(long.endsWith("…"));
});

test("sanitizeDetails keeps primitives and redacts strings", () => {
  const details = sanitizeDetails({
    count: 3,
    ok: true,
    missing: null,
    note: "token=abc",
    "": "dropped",
    bad: Number.NaN,
  });
  assert(details);
  assertEquals(details.count, 3);
  assertEquals(details.ok, true);
  assertEquals(details.missing, null);
  assertMatch(String(details.note), /redacted/);
  assertEquals("" in details, false);
  assertEquals(details.bad, "NaN");
  assertEquals(sanitizeDetails(undefined), undefined);
  assertEquals(sanitizeDetails({}), undefined);
});

test("the store is a bounded ring buffer", () => {
  let clock = 0;
  const store = new DiagnosticsStore(3, () => ++clock);
  store.note("boot", "one");
  store.note("boot", "two");
  store.note("boot", "three");
  store.note("boot", "four");
  assertEquals(store.size, 3);
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  assertEquals(snapshot.events.length, 3);
  assertEquals(snapshot.dropped, 1);
  assertEquals(snapshot.events[0]!.message, "two");
  assertEquals(snapshot.events[2]!.seq, 4);
});

test("record captures error message and sanitised stack", () => {
  const store = new DiagnosticsStore();
  const event = store.record({
    subsystem: "audio",
    message: "",
    error: new Error("boom token=abc"),
    stage: "build",
    details: { preset: "rain" },
  });
  assertEquals(event.kind, "error");
  assertEquals(event.subsystem, "audio");
  assertMatch(event.message, /boom token \[redacted\]/);
  assertEquals(event.stage, "build");
  assertEquals(event.details?.preset, "rain");
});

test("snapshot copies its events and details", () => {
  const store = new DiagnosticsStore();
  store.record({ subsystem: "boot", message: "ok", details: { a: 1 } });
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  snapshot.events[0]!.message = "mutated";
  snapshot.events[0]!.details!.a = 99;
  const again = store.snapshot({ appVersion: "2.0.0" });
  assertEquals(again.events[0]!.message, "ok");
  assertEquals(again.events[0]!.details?.a, 1);
});

test("clear() resets events and dropped count", () => {
  const store = new DiagnosticsStore(1);
  store.note("boot", "one");
  store.note("boot", "two");
  store.clear();
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  assertEquals(snapshot.events.length, 0);
  assertEquals(snapshot.dropped, 0);
});

test("formatDiagnostics includes the environment but no secrets", () => {
  const store = new DiagnosticsStore();
  store.record({
    subsystem: "network",
    message: "fetch failed https://example.com/x?token=leak",
  });
  const text = formatDiagnostics(
    store.snapshot({
      appVersion: "2.0.0",
      buildId: "abc",
      browser: "Chrome",
      os: "Windows",
      viewport: "1280x720",
      dpr: 2,
      online: true,
      hardwareConcurrency: 8,
      serviceWorkerControlled: true,
      features: { webAudio: true, hls: false },
    }),
  );
  assertMatch(text, /Session Clock diagnostics/);
  assertMatch(text, /App: 2\.0\.0 \(abc\)/);
  assertMatch(text, /Browser: Chrome/);
  assertMatch(text, /Features: webAudio=yes, hls=no/);
  assertMatch(text, /\[network\/error\]/);
  assertEquals(text.includes("leak"), false);
});

test("formatDiagnostics reports an empty log", () => {
  const text = formatDiagnostics({
    generatedAt: 0,
    environment: { appVersion: "2.0.0" },
    events: [],
    dropped: 0,
  });
  assertMatch(text, /Events \(0\):/);
  assertMatch(text, /\(none\)/);
});

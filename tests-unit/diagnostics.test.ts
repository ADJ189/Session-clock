import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DiagnosticsStore,
  formatDiagnostics,
  sanitizeDetails,
  sanitizeText,
  sanitizeUrl,
} from "../src/diagnostics.ts";

test("sanitizeUrl drops credentials, query and fragment", () => {
  assert.strictEqual(
    sanitizeUrl("https://user:secret@example.com/path?token=abc#frag"),
    "https://example.com/path",
  );
  assert.strictEqual(sanitizeUrl("https://example.com/a?b=1#c"), "https://example.com/a");
  assert.strictEqual(sanitizeUrl("not a url?secret=1#x"), "not a url");
  assert.strictEqual(sanitizeUrl(""), "");
});

test("sanitizeText redacts common secret shapes", () => {
  const bearer = sanitizeText("Authorization: Bearer abc.def.ghi");
  assert.doesNotMatch(bearer, /abc\.def\.ghi/);
  assert.match(bearer, /\[redacted\]/);

  const token = sanitizeText("token=super-secret-value");
  assert.doesNotMatch(token, /super-secret-value/);
  assert.match(token, /\[redacted\]/);

  const gh = sanitizeText("failed with ghp_ABCDEFGHIJKLMNOPQRSTUV123456");
  assert.doesNotMatch(gh, /ghp_/);

  const sk = sanitizeText("key sk-abcdefghijklmnopqrstuvwx");
  assert.doesNotMatch(sk, /sk-abcdefghijklmnopqrstuvwx/);
});

test("sanitizeText strips query strings from embedded URLs", () => {
  const text = sanitizeText(
    "GET https://example.com/api?access_token=leak failed",
  );
  assert.strictEqual(text.includes("leak"), false);
  assert.strictEqual(text, "GET https://example.com/api [redacted] failed");
});

test("sanitizeText normalises whitespace and caps length", () => {
  assert.strictEqual(sanitizeText("  a \n\n b\t c  "), "a b c");
  const long = sanitizeText("x".repeat(500), 10);
  assert.strictEqual(long.length, 11);
  assert.ok(long.endsWith("…"));
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
  assert.ok(details);
  assert.strictEqual(details.count, 3);
  assert.strictEqual(details.ok, true);
  assert.strictEqual(details.missing, null);
  assert.match(String(details.note), /redacted/);
  assert.strictEqual("" in details, false);
  assert.strictEqual(details.bad, "NaN");
  assert.strictEqual(sanitizeDetails(undefined), undefined);
  assert.strictEqual(sanitizeDetails({}), undefined);
});

test("the store is a bounded ring buffer", () => {
  let clock = 0;
  const store = new DiagnosticsStore(3, () => ++clock);
  store.note("boot", "one");
  store.note("boot", "two");
  store.note("boot", "three");
  store.note("boot", "four");
  assert.strictEqual(store.size, 3);
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  assert.strictEqual(snapshot.events.length, 3);
  assert.strictEqual(snapshot.dropped, 1);
  assert.strictEqual(snapshot.events[0]!.message, "two");
  assert.strictEqual(snapshot.events[2]!.seq, 4);
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
  assert.strictEqual(event.kind, "error");
  assert.strictEqual(event.subsystem, "audio");
  assert.match(event.message, /boom token \[redacted\]/);
  assert.strictEqual(event.stage, "build");
  assert.strictEqual(event.details?.preset, "rain");
});

test("snapshot copies its events and details", () => {
  const store = new DiagnosticsStore();
  store.record({ subsystem: "boot", message: "ok", details: { a: 1 } });
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  snapshot.events[0]!.message = "mutated";
  snapshot.events[0]!.details!.a = 99;
  const again = store.snapshot({ appVersion: "2.0.0" });
  assert.strictEqual(again.events[0]!.message, "ok");
  assert.strictEqual(again.events[0]!.details?.a, 1);
});

test("clear() resets events and dropped count", () => {
  const store = new DiagnosticsStore(1);
  store.note("boot", "one");
  store.note("boot", "two");
  store.clear();
  const snapshot = store.snapshot({ appVersion: "2.0.0" });
  assert.strictEqual(snapshot.events.length, 0);
  assert.strictEqual(snapshot.dropped, 0);
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
  assert.match(text, /Session Clock diagnostics/);
  assert.match(text, /App: 2\.0\.0 \(abc\)/);
  assert.match(text, /Browser: Chrome/);
  assert.match(text, /Features: webAudio=yes, hls=no/);
  assert.match(text, /\[network\/error\]/);
  assert.strictEqual(text.includes("leak"), false);
});

test("formatDiagnostics reports an empty log", () => {
  const text = formatDiagnostics({
    generatedAt: 0,
    environment: { appVersion: "2.0.0" },
    events: [],
    dropped: 0,
  });
  assert.match(text, /Events \(0\):/);
  assert.match(text, /\(none\)/);
});

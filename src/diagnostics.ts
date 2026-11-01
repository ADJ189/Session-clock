// ── Privacy-safe diagnostics ───────────────────────────────────────────
// A bounded, in-memory ring buffer for boot and post-boot failures. It is
// deliberately dependency-free so it can be unit-tested under Deno without a
// browser. Nothing here reads localStorage, request bodies or user content:
// callers pass short, already-known strings plus a coarse environment
// snapshot. `toText()` is what the user-triggered "Copy diagnostics" action
// exports.
//
// Design constraints from the reliability plan:
//  - bounded memory; no per-frame telemetry;
//  - one record per failure site (callers decide once-only semantics);
//  - timestamps, subsystem, stage and coarse browser/feature facts only;
//  - URLs lose query strings, hashes and credentials before storage;
//  - tokens and other secret-looking values are redacted.

export type DiagnosticSubsystem =
  | "boot"
  | "renderer"
  | "audio"
  | "storage"
  | "integration"
  | "service-worker"
  | "network"
  | "unknown";

export type DiagnosticKind =
  | "error"
  | "rejection"
  | "resource"
  | "event"
  | "readiness";

export type DiagnosticValue = string | number | boolean | null;

export interface DiagnosticEvent {
  /** Monotonic sequence number, useful when timestamps collide. */
  seq: number;
  /** Unix epoch milliseconds. */
  at: number;
  subsystem: DiagnosticSubsystem;
  kind: DiagnosticKind;
  message: string;
  stack?: string;
  stage?: string;
  details?: Record<string, DiagnosticValue>;
}

export interface DiagnosticEnvironment {
  appVersion: string;
  buildId?: string;
  browser?: string;
  engine?: string;
  os?: string;
  viewport?: string;
  screen?: string;
  dpr?: number;
  visibility?: string;
  qualityTier?: string;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  features?: Record<string, boolean>;
  serviceWorkerControlled?: boolean;
  online?: boolean;
}

export interface DiagnosticsSnapshot {
  generatedAt: number;
  environment: DiagnosticEnvironment;
  events: DiagnosticEvent[];
  dropped: number;
}

export interface RecordInput {
  subsystem: DiagnosticSubsystem;
  kind?: DiagnosticKind;
  message: string;
  error?: unknown;
  stack?: string;
  stage?: string;
  details?: Record<string, unknown>;
}

const DEFAULT_CAPACITY = 80;
const MAX_MESSAGE = 400;
const MAX_STACK = 2000;

// Matches common credential patterns without trying to be a full parser.
// The goal is to avoid exporting secrets if a third-party message includes
// one, not to classify every possible token format.
const SECRET_PATTERNS: [RegExp, string][] = [
  [/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]"],
  [
    /\b(access_token|refresh_token|id_token|token|client_secret|client_id|code|authorization|api[_-]?key|password|secret)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
    "$1 [redacted]",
  ],
  // Token-only patterns must not echo the match back in the replacement —
  // doing so would keep the secret in the exported diagnostics.
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[redacted]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted]"],
];

/** Remove credentials, query strings and fragment identifiers from a URL. */
export function sanitizeUrl(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    // Not an absolute URL. Still strip anything query/hash-like.
    return raw.split("?")[0]!.split("#")[0]!;
  }
}

/** Redact token-like material and cap a free-form string. */
export function sanitizeText(input: unknown, max = MAX_MESSAGE): string {
  let out = typeof input === "string" ? input : String(input ?? "");
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  // Absolute URLs in free text are common in resource-load failures.
  out = out.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => sanitizeUrl(match));
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > max) out = `${out.slice(0, max)}…`;
  return out;
}

/** Normalise detail values to a small, JSON-safe primitive set. */
export function sanitizeDetails(
  details: Record<string, unknown> | undefined,
): Record<string, DiagnosticValue> | undefined {
  if (!details) return undefined;
  const out: Record<string, DiagnosticValue> = {};
  for (const [key, value] of Object.entries(details)) {
    const safeKey = sanitizeText(key, 60);
    if (!safeKey) continue;
    if (value == null) {
      out[safeKey] = null;
    } else if (typeof value === "number") {
      out[safeKey] = Number.isFinite(value) ? value : String(value);
    } else if (typeof value === "boolean") {
      out[safeKey] = value;
    } else {
      out[safeKey] = sanitizeText(value, 200);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function errorParts(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Bounded ring buffer. Synchronous and allocation-conscious: a failure storm
 * costs one array shift at most, never an unbounded log.
 */
export class DiagnosticsStore {
  readonly capacity: number;
  private events: DiagnosticEvent[] = [];
  private seq = 0;
  private dropped = 0;
  private now: () => number;

  constructor(capacity = DEFAULT_CAPACITY, now: () => number = Date.now) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.now = now;
  }

  record(input: RecordInput): DiagnosticEvent {
    const parts = input.error !== undefined
      ? errorParts(input.error)
      : { message: input.message, stack: input.stack };
    const message = sanitizeText(input.message || parts.message);
    const event: DiagnosticEvent = {
      seq: ++this.seq,
      at: this.now(),
      subsystem: input.subsystem,
      kind: input.kind ?? "error",
      message,
      stage: input.stage ? sanitizeText(input.stage, 80) : undefined,
      stack: parts.stack ? sanitizeText(parts.stack, MAX_STACK) : undefined,
      details: sanitizeDetails(input.details),
    };
    this.events.push(event);
    if (this.events.length > this.capacity) {
      this.events.shift();
      this.dropped++;
    }
    return event;
  }

  /** Record a plain lifecycle fact (readiness change, SW event, etc.). */
  note(
    subsystem: DiagnosticSubsystem,
    message: string,
    details?: Record<string, unknown>,
    stage?: string,
  ): DiagnosticEvent {
    return this.record({
      subsystem,
      kind: "event",
      message,
      details,
      stage,
    });
  }

  snapshot(
    environment: DiagnosticEnvironment,
    generatedAt = this.now(),
  ): DiagnosticsSnapshot {
    return {
      generatedAt,
      environment: { ...environment },
      // Copy so a caller can't mutate the store's internal state.
      events: this.events.map((e) => ({
        ...e,
        details: e.details ? { ...e.details } : undefined,
      })),
      dropped: this.dropped,
    };
  }

  clear(): void {
    this.events = [];
    this.dropped = 0;
  }

  get size(): number {
    return this.events.length;
  }
}

function envLines(env: DiagnosticEnvironment): string[] {
  const lines = [`Generated: ${new Date().toISOString()}`];
  lines.push(`App: ${env.appVersion}${env.buildId ? ` (${env.buildId})` : ""}`);
  if (env.browser) lines.push(`Browser: ${env.browser}${env.engine ? ` / ${env.engine}` : ""}`);
  if (env.os) lines.push(`OS: ${env.os}`);
  if (env.viewport) lines.push(`Viewport: ${env.viewport}${env.dpr ? ` @${env.dpr}x` : ""}`);
  if (env.screen) lines.push(`Screen: ${env.screen}`);
  if (env.visibility) lines.push(`Visibility: ${env.visibility}`);
  if (env.qualityTier) lines.push(`Quality tier: ${env.qualityTier}`);
  if (env.hardwareConcurrency != null) lines.push(`CPU threads: ${env.hardwareConcurrency}`);
  if (env.deviceMemoryGb != null) lines.push(`Device memory: ${env.deviceMemoryGb} GB`);
  if (env.online != null) lines.push(`Online: ${env.online}`);
  if (env.serviceWorkerControlled != null) lines.push(`SW controlled: ${env.serviceWorkerControlled}`);
  if (env.features) {
    const on = Object.entries(env.features).map(([k, v]) => `${k}=${v ? "yes" : "no"}`);
    lines.push(`Features: ${on.join(", ")}`);
  }
  return lines;
}

/** Render a copy/paste-friendly report. Never includes user content. */
export function formatDiagnostics(snapshot: DiagnosticsSnapshot): string {
  const lines = ["Session Clock diagnostics", "-------------------------", ...envLines(snapshot.environment)];
  if (snapshot.dropped) lines.push(`Dropped events: ${snapshot.dropped}`);
  lines.push("", `Events (${snapshot.events.length}):`);
  if (!snapshot.events.length) lines.push("  (none)");
  for (const e of snapshot.events) {
    const when = new Date(e.at).toISOString();
    lines.push(`- ${when} [${e.subsystem}/${e.kind}]${e.stage ? ` stage=${e.stage}` : ""} ${e.message}`);
    if (e.details) {
      const pairs = Object.entries(e.details).map(([k, v]) => `${k}=${String(v)}`);
      if (pairs.length) lines.push(`  ${pairs.join(" ")}`);
    }
    if (e.stack) {
      for (const row of e.stack.split("\n").slice(0, 8)) lines.push(`    ${row}`);
    }
  }
  return lines.join("\n");
}

// ── Runtime wiring ─────────────────────────────────────────────────────
// `installDiagnostics` is called once from main.ts after the module graph is
// evaluated. The inline boot guard in index.html writes into
// `window.__scPreBootEvents`; those are drained on install so failures that
// happened before this module loaded are not lost.

export interface DiagnosticsRuntimeOptions {
  environment: () => DiagnosticEnvironment;
  stage?: string;
  /** Defaults to window. Optional so tests can pass a stub. */
  target?: EventTarget;
  store?: DiagnosticsStore;
}

interface ScDiagnosticsWindow {
  __scPreBootEvents?: Array<Record<string, unknown>>;
  __scDiagnosticsText?: () => string;
  __scDiagnosticsSnapshot?: () => DiagnosticsSnapshot | null;
  __scDiagnostics?: DiagnosticsRuntime;
}

export interface DiagnosticsRuntime {
  store: DiagnosticsStore;
  environment: () => DiagnosticEnvironment;
  install: () => void;
  text: () => string;
  snapshot: () => DiagnosticsSnapshot;
  record: (input: RecordInput) => DiagnosticEvent;
}

let runtime: DiagnosticsRuntime | null = null;
let installed = false;

function preBootEvents(target: EventTarget): Array<Record<string, unknown>> {
  const w = target as unknown as ScDiagnosticsWindow;
  return Array.isArray(w.__scPreBootEvents) ? w.__scPreBootEvents : [];
}

export function getDiagnosticsRuntime(): DiagnosticsRuntime | null {
  return runtime;
}

export function createDiagnosticsRuntime(
  options: DiagnosticsRuntimeOptions,
): DiagnosticsRuntime {
  const store = options.store ?? new DiagnosticsStore();
  const stage = options.stage ?? "runtime";
  const snapshot = () => store.snapshot(options.environment());
  const text = () => formatDiagnostics(snapshot());
  return {
    store,
    environment: options.environment,
    install: () => {},
    text,
    snapshot,
    record: (input) => store.record({ ...input, stage: input.stage ?? stage }),
  };
}

/**
 * Install global `error` / `unhandledrejection` capture. Idempotent. After
 * boot the app keeps recording; the plan explicitly requires post-boot
 * capture, not only boot-time capture.
 */
export function installDiagnostics(
  options: DiagnosticsRuntimeOptions,
): DiagnosticsRuntime {
  const target = options.target ?? globalThis;
  const store = options.store ?? new DiagnosticsStore();
  const stage = options.stage ?? "runtime";
  const snapshot = () => store.snapshot(options.environment());
  const text = () => formatDiagnostics(snapshot());

  runtime = {
    store,
    environment: options.environment,
    install: () => {},
    text,
    snapshot,
    record: (input) => store.record({ ...input, stage: input.stage ?? stage }),
  };

  if (!installed) {
    installed = true;
    const onError = (event: Event) => {
      const e = event as ErrorEvent;
      const t = e.target as (EventTarget & { tagName?: string; src?: string; href?: string }) | null;
      // Resource element failures bubble here with no `error` object.
      if (t && t !== (target as unknown) && t.tagName) {
        const name = t.tagName.toLowerCase();
        if (name === "script" || name === "link" || name === "img" || name === "audio") {
          store.record({
            subsystem: name === "audio" ? "audio" : "network",
            kind: "resource",
            message: `Failed to load ${name}`,
            details: { url: sanitizeUrl(t.src || t.href || "") },
          });
          return;
        }
      }
      store.record({
        subsystem: inferSubsystem(`${e.filename ?? ""} ${e.message ?? ""}`),
        kind: "error",
        message: e.message || "Uncaught error",
        error: e.error,
        details: {
          file: e.filename ? sanitizeUrl(e.filename) : "",
          line: e.lineno ?? 0,
          column: e.colno ?? 0,
        },
      });
    };
    const onRejection = (event: Event) => {
      const e = event as PromiseRejectionEvent;
      store.record({
        subsystem: inferSubsystem(String((e.reason as { message?: string })?.message ?? e.reason ?? "")),
        kind: "rejection",
        message: "Unhandled promise rejection",
        error: e.reason,
      });
    };
    target.addEventListener("error", onError as EventListener, true);
    target.addEventListener("unhandledrejection", onRejection as EventListener);
  }

  // Drain anything captured by the inline boot guard before this module ran.
  for (const raw of preBootEvents(target).splice(0)) {
    store.record({
      subsystem: (raw.subsystem as DiagnosticSubsystem) ?? "boot",
      kind: (raw.kind as DiagnosticKind) ?? "error",
      message: String(raw.message ?? "Pre-boot failure"),
      stack: typeof raw.stack === "string" ? raw.stack : undefined,
      stage: "pre-boot",
      details: raw.details as Record<string, unknown> | undefined,
    });
  }

  const w = target as unknown as ScDiagnosticsWindow;
  w.__scDiagnostics = runtime;
  w.__scDiagnosticsText = text;
  w.__scDiagnosticsSnapshot = snapshot;
  return runtime;
}

function inferSubsystem(text: string): DiagnosticSubsystem {
  const t = text.toLowerCase();
  if (t.includes("serviceworker") || t.includes("service worker") || t.includes("sw.js")) {
    return "service-worker";
  }
  if (t.includes("audio") || t.includes("audiocontext") || t.includes("decodeaudio")) return "audio";
  if (t.includes("canvas") || t.includes("renderer") || t.includes("draw")) return "renderer";
  if (t.includes("localstorage") || t.includes("storage") || t.includes("quota")) return "storage";
  if (t.includes("fetch") || t.includes("network") || t.includes("jsdelivr")) return "network";
  return "unknown";
}

/** Best-effort copy action used by the boot-failure screen. */
export async function copyDiagnosticsText(text: string): Promise<boolean> {
  try {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const doc = globalThis.document;
    if (!doc) return false;
    const area = doc.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    doc.body.appendChild(area);
    area.select();
    const ok = doc.execCommand?.("copy") ?? false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

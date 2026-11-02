# Session Clock 2.0.0 — Implementation and Compliance Report

**Date:** 2026-11-02  
**Workspace:** `C:\Users\deepa\Downloads\Session-clock-2.0.0\Session-clock-2.0.0`  
**State:** working-tree changes only — no commits, no deployment, no git operations.

This report checks the four planning documents against the code that actually
exists in this workspace, lists the commands that were run in this pass, and
separates verified work from work that is implemented but cannot be verified
here (or was deliberately left as a proposal).

Planning documents audited:

1. `Session-Clock-Combined-Engineering-Plan.md` (reliability, audio engine,
   testing, deliverables).
2. `session-clock-v2.0.0-ui-updates-draft.md` (Beta tags, Theme Finder, clock
   defaults).
3. `Session-Clock-Spatial-Audio-HRTF-Integration-Spec.md` (HRTF graph, profiles,
   listener, binaural isolation, test checklist).
4. `Session-Clock-Svelte-UI-Migration-Supplement.md` (proposal-only policy).

---

## 1. Requirement-by-requirement compliance

Status vocabulary:

- **Verified** — implemented and covered by a command/test that was run here.
- **Implemented, not verified here** — code exists, but the check needs real
  hardware, real Safari/iOS/Android, live CDN media, or human listening.
- **Partial** — the main behaviour exists, but a specific clause is not fully
  satisfied.
- **Proposal only** — intentionally not implemented.

### 1.1 UI update document

| Requirement | Status | Evidence / caveat |
| --- | --- | --- |
| One reusable quiet `Beta` pill, title case, neutral tokens | **Verified** | `.beta-tag` in `style.css`; `tests/beta.spec.ts` checks text, pill radius, type scale, no emoji. |
| Beta in the home feature dock on Settings | **Verified** | `#btnSettings .beta-tag`, generated in `src/main.ts`; tested. |
| Beta beside the Settings modal heading | **Verified** | `#settingsOverlay .modal-title-row .beta-tag`; tested. |
| Beta beside the Integrations modal heading | **Verified** | `#integrationsOverlay .modal-title-row .beta-tag`; tested after opening the overlay. |
| Beta on the Integrations section in Settings General | **Verified** | `makeSection("Integrations", true)`; tested. |
| Exactly four placements, no per-provider badges | **Verified** | `tests/beta.spec.ts` asserts `.beta-tag` count is 4 after Settings is built. |
| Parent controls keep their accessible name and keyboard behaviour | **Verified** | Dock button is `aria-label="Settings"` + `aria-describedby`; headings are `aria-label="Settings"/"Integrations"` + description. Beta is not a focus target. Tested with `toHaveAccessibleName` / `toHaveAccessibleDescription`. |
| Readable in dark/light and at mobile widths | **Verified** | Contrast ≥ 4.5:1 in both themes; 320 px clipping test. |
| No emoji / pulse / colour-only / oversized badge | **Verified** | CSS and DOM assertions. |
| Theme Finder: one header, one nav, one catalogue grid | **Verified** | Structure tests in `tests/themelib.spec.ts`; duplicate world shelf/feature cards removed. |
| Compact current-theme strip, not a hero | **Verified** | `.tl-spotlight` retained as a compact strip; structure test. |
| Recent rail only when recents exist and the unfiltered All view is active | **Verified** | `renderRecents()` gating; test covers presence/absence. |
| Recent maximum stays 12 and “View all” opens Recently used | **Verified** | `RECENT_MAX = 12`; `#tlRecentAll` wired to `setView("recent")`. |
| Real generated previews where available | **Partial** | `addPreviewArt()` supports real preview images with a clean CSS scene fallback. `PREVIEW_IDS` is empty and `public/theme-previews/` is absent in this workspace, so the **fallback is the shipped path**. The preferred generator output was not produced/committed here. Acceptance allows an intentional fallback, so this passes the fallback clause but not the “preferred real captures” clause. |
| Search, sort, favourites, recents, categories, empty states | **Verified** | `tests/themelib.spec.ts` covers filtering, A–Z, favourites persistence, recents, categories, empty state. |
| Theme selection still runs through `applyTheme()` | **Verified** | `deps.apply` call preserved; selection test applies and persists a theme. |
| Card cache reused during search/filter; focus preserved | **Verified** | Search/clear reuse test marks card nodes and confirms all 103 survive; clear-search keeps focus in `#tlSearch`. |
| No external image requests for previews | **Verified** | No remote preview dependency; fixtures abort third-party requests. |
| 44 px touch targets and no horizontal overflow | **Verified** | Close/favourite/collection targets measured at 390 px and 320 px; document scroll width checked. |
| First-open performance measured on desktop and mobile-sized viewport | **Verified** | Chromium with 4× CPU throttling: desktop **2427 ms**, 390 px **2684 ms**; test budget is < 8000 ms. |
| Reduced motion and keyboard focus remain correct | **Verified** | Reduced-motion assertion in `tests/resilience.spec.ts`; Escape focus-return test in `tests/themelib.spec.ts`. |
| Clock defaults to HH:MM; saved `"0"` wins | **Verified** | `hideSeconds`/`hideMs` default only when storage is absent; tests cover clean profile and explicit saved preferences. |
| Immediate toggle, reload persistence | **Verified** | `tests/redesign.spec.ts` toggles both, reloads, rechecks. |
| Hiding seconds hides ms but retains the saved ms preference | **Verified** | Regression test checks DOM visibility and the stored value. |
| All clock styles obey the preference, including the analogue second hand | **Verified** | Analogue canvas exposes `data-seconds-hidden`; test toggles it. Digital/flip/segment/minimal share `hideSeconds`. |
| Layout recentres with no hidden-digit gap | **Verified** | Row width grows and stays centred after revealing digits. |

### 1.2 Combined engineering plan

| Requirement | Status | Evidence / caveat |
| --- | --- | --- |
| Canvas context may be `null`; no non-null assumption | **Verified** | `get2d()` + null proxy in `src/renderer.ts`; missing background/transition tests. |
| Renderer failure is contained; one diagnostic; no per-frame retry | **Verified** | `rendererHealth` state machine; forced `ctx.save()` throw records once and is not re-entered. |
| Static fallback keeps clock/timer usable | **Verified** | `body.renderer-fallback`; clock seconds advance and timer starts/stops in the same test. |
| Lost context degrades; restored context resumes drawing | **Verified** | `contextlost`/`contextrestored` path tested; `restoreBackground()`/`restoreTransitions()` re-enable the path while retaining failure history. |
| AudioContext unavailable/blocked does not crash | **Verified** | `ensureCtxSafe()` marks audio unavailable; track/binaural/chime/crossfade calls return safely; the sound mixer shows disabled unavailable tracks. Browser test injects a throwing `AudioContext`. |
| Optional dynamic import failure is recoverable | **Verified** | Legal text chunk aborted; retry toast shown, overlay does not open, clock stays usable. |
| Service-worker registration failure leaves app usable | **Verified** | Registration forced to reject; app boots and timer/clock work. |
| Storage unavailable does not crash startup | **Verified** | `tests/storage.spec.ts` makes every storage access throw and still boots. |
| Reduced motion is honoured | **Verified** | Emulated reduce; theme-card transition is effectively 0 s and the clock remains usable. |
| Truthful core/renderer/audio readiness | **Verified** | `__bootStage`, `__coreReady`, `__rendererReady`, `__bootCompleted`; boot guard turns fatal only when core readiness is false. |
| Bounded, privacy-safe diagnostics | **Verified** | Ring buffer, URL cleaning, per-pattern secret redaction, `Copy diagnostics` in Settings → Compatibility; Deno tests cover sanitising/ring buffer. |
| Service-worker cache generation survives worker restart | **Verified** | Cache name derives from a build stamp; `sw-core.js` helpers unit-tested. |
| Install/activate/reload/offline startup | **Verified (Chromium only)** | `tests/pwa.spec.ts`: active worker, reload, manifest, precache manifest, offline reload. Offline emulation is deliberately skipped on Firefox/WebKit. |
| Update from build A to B and stale-tab behaviour | **Partial** | Cache naming/lifecycle is unit-tested; a live two-build upgrade + stale-tab browser test was not added. |
| Worker termination/restart | **Partial** | The cache name is re-derived from the stamped script on every event (unit-tested). An actual browser worker kill/restart cycle was not exercised. |
| Cache writes are paired with `event.waitUntil()` | **Verified by inspection** | `public/sw.js` wraps install/activate/cache writes; no automated assertion parses every call site. |
| Old caches are deleted only after the new cache is ready | **Verified by inspection** | `activate` checks the new cache and readiness marker before calling `shouldDeleteCache`; no multi-build browser run confirms ordering. |
| Failed precache leaves the app usable online | **Not run** | The failure branch is present, but no test forces a partial precache failure in a browser. |
| Optional modules lazily loaded where justified | **Partial** | `legal`, `litclock`, `github`, `qr`, and `share` are lazy chunks. Music dock, weather, the audio engine, and diagnostics remain in the initial graph (diagnostics is also statically imported, so its dynamic import does not split). No measured before/after startup comparison was recorded. |
| Custom engine covers all 35 presets | **Verified** | `AMBIENT_PRESET_IDS` length 35; engine tests build every preset. `wind`/`snow` were missing and are now implemented. |
| Waterfall procedural fallback | **Verified** | Waterfall is a file-backed track with `proceduralFallback: true`; engine test builds it. |
| Recording-first CDN, URLs, crossfades, gain trims unchanged | **Verified** | Snapshot test locks `https://cdn.jsdelivr.net/gh/ADJ189/Ambient-Sounds@v2`, all 12 paths, crossfade seconds, gain trims, fallback flags. No pre-change checksum was captured, so this is a value lock rather than a byte-for-byte diff. |
| Ambiently removed only after custom coverage | **Verified** | Removed from `package.json`, `package-lock.json`, `deno.lock`, `node_modules`; engine tests cover the catalogue. `animejs` remains. |
| Existing sound IDs/names/order/icons, toggles, storage keys | **Verified** | `tests-deno/sound.test.ts` snapshots IDs/order/names/icons/accents and public API; UI/storage tests cover toggles. |
| Binaural presets and separate path preserved | **Verified** | Five presets with carriers/beats asserted; graph test confirms two oscillators + merger and no HRTF panner. |
| Playwright five named projects, 2 workers | **Verified** | `playwright.config.ts`: `desktop-chromium`, `desktop-firefox`, `desktop-webkit`, `mobile-chromium-emulation`, `mobile-webkit-emulation`; 2 workers. |
| Targeted `@smoke` / `@mobile` / `@cross-browser` selection | **Verified** | Firefox/WebKit run `@smoke`; mobile config runs `@mobile`; resilience tests carry all three tags. |
| `@audio` / `@pwa` / `@stress` / `@nightly` tagged groups | **Not done** | The recommended inventory names those groups, but only `@smoke`, `@mobile`, and `@cross-browser` are implemented. `tests/pwa.spec.ts` exists without a `@pwa` tag; audio coverage lives in Deno; no stress/nightly project exists. |
| Full test/typecheck/lint/build results reported | **Verified** | Section 3 below. |
| Performance report: bundle, startup, CPU/RAM, audio nodes | **Partial** | Bundle sizes and Theme Finder timings recorded. No CPU/RAM profile or audio-node count under 1/3/5 simultaneous tracks was measured at runtime. Graph tests count nodes structurally. |
| Exact file/line root-cause references | **Verified** | Section 4 below. |
| Full repository ZIP | **Not done** | The workspace is the full repository and no patch-only artifact was produced, but no ZIP was created in this pass. |
| CHANGELOG / implementation report | **Verified** | This file. |
| No runtime dependency added | **Verified** | `package.json` runtime dependency remains `animejs` only. |
| Keep TypeScript/browser-native architecture | **Verified** | No framework or migration introduced. |

### 1.2.1 Audio acceptance criteria (combined plan §4.15)

These are called out separately because several are real-time or perceptual
checks that automated graph tests cannot prove.

| Criterion | Status | Evidence / caveat |
| --- | --- | --- |
| All repository sound IDs have procedural implementations | **Verified** | 35 IDs in `AMBIENT_PRESET_IDS`; `tests-deno/engine.test.ts` builds every one and asserts a non-empty voice. |
| All 12 CDN recording definitions and URLs unchanged | **Verified (value lock)** | Snapshot test pins the CDN base, all 12 paths, crossfade seconds, gain trims, and fallback flags. No pre-change checksum exists, so this is not a byte-for-byte diff. |
| CDN remains primary whenever playable | **Implemented, not verified live** | Every file-backed maker goes through `makeFileTrack()`, whose procedural maker is only used after a media failure. Live CDN playback was not fetched in tests. |
| Recording failure switches to procedural fallback automatically | **Implemented, not verified live** | The fallback path is exercised in Deno because the media probe reports no Opus support. A real 404/decode/network failure in a browser was not induced. |
| Waterfall has a procedural fallback | **Verified** | `proceduralFallback: true` in `FILE_TRACKS.waterfall`; the engine builds the waterfall preset. |
| Opus-unsupported browsers can use all file-backed sounds procedurally | **Verified in Deno** | The Deno media probe returns no Opus support, and all 12 file-backed tracks still start through their fallback maker. Browser-live behaviour was not fetched. |
| Existing UI, gain, analyser, spatialisation, compressor and binaural features continue to work | **Verified structurally** | Graph tests assert the shared analyser/compressor path; UI tests cover the mixer and binaural controls. Perceptual output is not measured. |
| Start/stop does not accumulate nodes, timers, buffers or tasks | **Verified (unit)** | New test runs **50 start/stop cycles for each of the 35 presets** and asserts zero nodes/sources/tasks after every cycle. A 5-track concurrency test covers independent allocation and release. Long browser sessions were not profiled. |
| No clicks/pops caused by abrupt graph changes | **Not verified** | Requires listening or discontinuity analysis; no rendered PCM was inspected. |
| No NaN/Infinity, DC runaway or sustained clipping | **Partial** | Control math rejects non-finite values and tests assert finite coordinates/params. The mock does not render PCM, so clipping/DC was not measured. |
| No obvious short-period loop in continuous ambience | **Not verified** | Requires listening or spectral analysis. |
| At least one simple and one event-heavy preset run for 10 minutes | **Not run** | No real-time 10-minute session was executed. |
| Five simultaneous tracks run for at least 5 minutes | **Not run** | A structural 5-track start/stop test was added, but not a 5-minute real-time run. |
| At least 50 start/stop cycles per preset | **Verified** | New `tests-deno/engine.test.ts` case: 35 presets × 50 cycles. |
| Measure one track, five tracks and the heaviest supported mix | **Partial** | Node/task counts are asserted structurally; no CPU/RAM/real-time measurement was captured. |
| Visual LOW quality tier must not silently reduce audio quality | **Verified by inspection** | `getTier()` is read only by the canvas renderer and battery warning, not by the audio graph; no audio parameter is tier-dependent. |

### 1.3 Spatial audio / HRTF specification

| Requirement | Status | Evidence / caveat |
| --- | --- | --- |
| One typed spatial profile for each of the 35 sound IDs | **Verified** | `SPATIAL_PROFILES` key equality test; range/finite/movement tests. |
| Native `PannerNode` with `panningModel = "HRTF"` is primary | **Verified** | Graph test: track gain → HRTF panner → analyser; exactly one panner. A per-ID loop walks all 35 presets and re-checks the same edge. |
| Equal-power `StereoPannerNode` fallback | **Verified** | `createPanner()` failure and rejected `panningModel` both fall back; rejected HRTF node is left disconnected. |
| Old manual ITD/ILD chain not stacked on HRTF | **Verified** | Legacy chain removed; fallback is a single stereo panner. |
| Shared AudioContext and master chain preserved | **Verified** | One context; `trackGain → panner → analyser → masterGain → compressor → destination`. |
| No generator connects directly to `destination` | **Verified** | Engine returns `{ out, nodes }`; graph tests assert the shared path. |
| Attach/detach exactly once; no duplicate edges | **Verified** | Enable/disable, six repeated toggle cycles, stop/replay, two-track isolation, and an all-35-preset loop assert direct vs panner edges with no duplicate routes. |
| Stop disposes panner/movement rig | **Verified** | `stopTrack()` deletes the rig; replay rebuilds it. |
| Opus decks crossfade before the track panner | **Implemented, not fully verified** | `GaplessLoopPlayer` keeps deck A/B → crossfade gains → stable `out`; `playTrack()` adds the panner after the track gain. A live two-deck crossfade with real Opus was not measured in a browser. |
| Procedural fallback reuses the same panner | **Verified structurally** | Fallback connects to the stable file output upstream of the track gain/panner; file-vs-synth graph test. Live network-failure fallback was not fetched. |
| No automatic mono downmix | **Verified by inspection** | No `channelCount = 1` or channel averaging is set; layout stays `auto`. |
| Real Opus channel layouts inspected | **Not possible here** | Binaries are remote and fixtures abort cross-origin requests. Report marks them unverified; no mono/stereo claim is made. |
| Head tracking updates `AudioListener.forward/up`, not gamma-pan | **Verified** | `src/audio/listener.ts` quaternion/basis conversion; cardinal and screen-rotation tests. |
| Permission denied/unsupported leaves HRTF active with fixed listener | **Verified** | Tracking is optional; failure paths leave the default listener. |
| Null/NaN sensor samples rejected; updates smoothed/throttled | **Verified** | Listener tests; `onOrientationSample` throttles to ~30 Hz. |
| Subscribe once; disable unsubscribes and resets | **Verified** | `getOrientationSubscriberCount()` test: 1 after repeated enable, 0 after disable. |
| Binaural beats never enter HRTF | **Verified** | Graph test: no HRTF panner, separate merger path, preset IDs/carriers/beats unchanged. |
| `sc_spatial` / `sc_head_tracking` keys preserved | **Verified** | No key renames; tests exercise the public setters. |
| Spatial default remains off | **Verified** | `sc_spatial` read only when `"1"`; sound test default is false after storage isolation. |
| Perceptual headphone listening on real devices | **Not done** | No headphones/measurement rig, no real iOS/Android device. Automated graph/geometry tests cannot establish perceptual quality. |

### 1.4 Svelte supplement

| Requirement | Status | Evidence |
| --- | --- | --- |
| Proposal only; no full migration | **Verified** | No Svelte dependency, code, or build change. Section 7 keeps the pilot proposal. |
| Preserve storage keys, DOM ids, `applyTheme()`, card cache if piloted | **Verified as proposal text** | Proposal explicitly keeps them. |

---

## 2. Files changed

### Application source

| File | Change |
| --- | --- |
| `src/main.ts` | Beta dock label/description, Settings Beta section, Integrations Beta section, clock-default wiring, copy-diagnostics action, sound-unavailable UI, Theme Finder integration. |
| `src/themelib.ts` | Content-first Theme Finder: compact current strip, conditional recents rail, one catalogue grid, preview/fallback art, cached cards. |
| `src/sound.ts` | Safe `AudioContext` handling, HRTF rig lifecycle, equal-power fallback, listener/head tracking, binaural path, public API. |
| `src/soundfiles.ts` | Recording-first loader, CDN base, crossfades/gain trims, procedural fallback. |
| `src/soundsynth.ts` | Engine-backed synth adapter and preset aliases. |
| `src/audio/engine.ts` | 35-preset synthesis engine; `wind`/`snow` added; `manualScheduler` hook. |
| `src/audio/scheduler.ts` | `autoStart` option for deterministic tests. |
| `src/audio/spatial.ts` | Typed profiles for every preset, position/movement math. |
| `src/audio/listener.ts` | Device orientation → listener vectors, smoothing, screen rotation. |
| `src/audio/dsp.ts`, `noise.ts`, `prng.ts` | Shared audio helpers, noise cache, seeded PRNG. |
| `src/renderer.ts` | Nullable 2D contexts, static fallback, context-loss/restore handling. |
| `src/rendererHealth.ts` | Renderer failure state machine plus `restoreBackground()` / `restoreTransitions()`. |
| `src/diagnostics.ts` | Per-pattern secret redaction (token-only patterns no longer echo the secret). |
| `src/platform.ts` | Dynamic orientation capability getter, orientation subscriber introspection. |
| `src/globals.ts`, `src/webapi.d.ts` | Type surface for non-standard APIs. |
| `index.html` | Beta tags/accessible names on Settings and Integrations headings; Theme Finder markup. |
| `style.css` | Beta pill, Theme Finder layout, 44 px touch targets, responsive/reduced-motion rules. |
| `public/sw.js`, `public/sw-core.js` | Build-stamped cache names and shared testable helpers. |
| `vite.config.ts` | Service-worker build stamp. |

### Tests and tooling

| Path | Change |
| --- | --- |
| `tests-deno/deno.json` | Offline test config. |
| `tests-deno/assert.ts` | Local assertion helpers (no JSR dependency). |
| `tests-deno/dom-stubs.ts` | Deterministic DOM/localStorage stubs; fresh store per test process. |
| `tests-deno/mock-audio.ts` | Extended Web Audio mock: HRTF/stereo panners, analyser, compressor, merger, media source, listener, context flags. |
| `tests-deno/spatial-graph.test.ts` | **New** graph topology, fallback, teardown, file/synth choke point, bypass, binaural isolation, movement, head tracking, repeated toggle cycles, two-track isolation, and an all-35-preset on/off routing loop. |
| `tests-deno/rendererHealth.test.ts` | Context-restore re-enable and retained failure history. |
| `tests-deno/engine.test.ts` | All 35 presets build/start/stop, determinism, cache sharing, 50 start/stop cycles per preset, 5-track concurrency. |
| `tests-deno/sound.test.ts` | IDs/order/names/icons, accents, CDN/trims, binaural, API/defaults. |
| `tests-deno/spatial.test.ts`, `listener.test.ts` | Profile ranges, position math, cardinal orientations, screen rotation, smoothing. |
| `tests-deno/diagnostics.test.ts` | URL/text/detail sanitising, redaction, ring buffer. |
| `tests-deno/sw.test.ts` | Cache naming, build stamp, allowlist, request/response rules. |
| `tests/beta.spec.ts` | **New** Beta count/placements, accessible names/descriptions, pill geometry, dark/light contrast, 320 px fit. |
| `tests/resilience.spec.ts` | **New** missing/lost/restored canvas, one-shot draw failure, AudioContext failure, lazy-import failure, SW registration failure, reduced motion. |
| `tests/themelib.spec.ts` | Single header/nav/grid, 44 px targets, 320 px overflow, focus retention, card cache reuse, first-open budget. |
| `tests/redesign.spec.ts` | Clock-default toggles, reload persistence, ms retention, analogue hand, recentring. |
| `tests/pwa.spec.ts` | Worker activation, reload, manifest, precache manifest, Chromium offline startup. |
| `playwright.config.ts` | Five named projects, 2 workers, tag routing. |
| `playwright.shared.ts` | Shared use/web-server, Deno-only commands. |
| `playwright.mobile.config.ts` | Focused mobile job, 2 workers. |
| `package.json`, `deno.json` | Deno-run scripts; corrected Vite invocation; `deno task dev`; added `check`. |
| `package-lock.json`, `deno.lock` | Ambiently removed. |
| `README.md` | Quick Start uses Deno tasks. |
| `AGENTS.md` | Commands and Playwright project names updated to the Deno-only setup. |

---

## 3. Commands actually run and results

All commands were run in
`C:\Users\deepa\Downloads\Session-clock-2.0.0\Session-clock-2.0.0`.

### Deno unit suite

```powershell
deno task test
```

Result: **105 passed, 0 failed** (`ok | 105 passed | 0 failed`).

> PowerShell may report exit code `1` because Deno writes its `Check …` progress
> lines to stderr; the rendered summary is the authoritative result.

### TypeScript

```powershell
deno run -A npm:typescript@7.0.2/tsc --noEmit
deno run -A npm:typescript@7.0.2/tsc -p tests/tsconfig.json
deno task check:resilience
```

Result: **no type errors**. `check:resilience` reports `Check` for
`src/diagnostics.ts`, `src/rendererHealth.ts`, and `src/audio/engine.ts`.

### Lint

```powershell
deno run -A npm:oxlint@1.89.0 .
```

Result: **warnings only, no errors**. Warnings are existing
`no-unused-vars`, `consistent-function-scoping`, `prefer-add-event-listener`,
and similar findings; none block the build.

### Production build

```powershell
deno task build
```

Result: **build succeeded.**

- `dist/index.html` — 69.64 kB (15.95 kB gzip)
- `dist/assets/index-*.css` — 206.41 kB (39.05 kB gzip)
- main JS chunk — 569.06 kB (171.27 kB gzip)
- lazy chunks — `github` 0.64 kB, `qr` 2.58 kB, `share` 3.88 kB, `legal` 7.20 kB, `litclock` 20.10 kB
- Vite warns about the >500 kB main chunk and the mixed static/dynamic import
  of `diagnostics.ts`; both are warnings, not errors.

### Playwright

Each run builds the production bundle and serves `dist/` with `vite preview` on
`127.0.0.1:4173`. The fixture aborts third-party requests, so tests do not
depend on live CDN uptime.

| Command | Result |
| --- | --- |
| `deno task test:e2e:chromium` | **95 passed** (4.5 min) — full `desktop-chromium` suite |
| `… test --project=desktop-firefox --project=desktop-webkit` | **24 passed** (2.3 min) — `@smoke`, 12 per engine |
| `deno task test:e2e:mobile` | **28 passed** (2.5 min) — `@mobile`, 14 per mobile profile |
| Theme Finder first-open (Chromium, 4× CPU throttle) | desktop **2427 ms**, 390 px **2684 ms**; budget < 8000 ms |

Per-project results are reported separately. WebKit is Playwright’s build, not
real Safari, and mobile projects are emulation, not physical devices.

### Regressions found by this audit and fixed

1. **Beta accessible name.** The dock button’s name had become “Settings Beta”
   and hidden overlay headings were not exposed. Now the controls keep
   “Settings”/“Integrations” as their name and expose “Beta” as the description;
   the Beta test opens the Integrations overlay before asserting.
2. **`deno test` localStorage leakage.** Deno’s persistent `localStorage`
   supplied `sc_spatial=1` from an earlier run, so a “defaults off” test failed
   on a second run. `tests-deno/dom-stubs.ts` now installs a fresh in-memory
   store per test process.
3. **Reducer/route test assumptions.** The legal chunk was served by the service
   worker, bypassing `page.route`; resilience tests now block service workers
   and test registration failure explicitly. Reduced-motion duration is asserted
   numerically because engines serialise `0.01ms` as `1e-05s`.
4. **44 px collection targets.** `.tl-nav-item` had a late 36 px override and
   32–34 px mobile overrides. All now use `var(--ui-hit)`.
5. **Renderer restore.** A restored canvas context re-enabled drawing but left
   the health state disabled. `restoreBackground()` / `restoreTransitions()`
   now re-enable the path while retaining failure history.
6. **AudioContext constructor failure.** `unlockAudio()` previously caught the
   throw, but later play calls still constructed a context. `ensureCtxSafe()`
   now records unavailability and all public play paths return safely; the
   mixer renders disabled tracks.
7. **`wind`/`snow` presets, diagnostics secret echo, scheduler wall timers,
   invalid Vite binary path** — fixed earlier in the same working tree.

---

## 4. Root-cause references for changed crash paths

| Crash path | Root cause | Fix location |
| --- | --- | --- |
| Canvas context is `null` | `getContext("2d")!` was treated as non-null | `src/renderer.ts` — `get2d()`, null proxy, `applyStaticFallback()` (around lines 150–216) |
| Renderer throws every frame | No boundary around optional draw work | `src/renderer.ts` `drawBg()` (around 341–356) + `rendererHealth` state machine |
| Lost context never resumes | Restore handler replaced the context but not health state | `src/renderer.ts` context listeners (around 220–250); `src/rendererHealth.ts` restore methods |
| AudioContext blocked | Constructor throw escaped into play/gesture handlers | `src/sound.ts` `ensureCtxSafe()` (around 333–375); public play/toggle/crossfade/chime guards |
| Diagnostics leaked tokens | Token-only patterns replaced with `$1`, echoing the match | `src/diagnostics.ts` `SECRET_PATTERNS` (around 90–128) |
| SW cache name lost on worker restart | Cache name lived only in a worker global | `public/sw.js` build stamp + `public/sw-core.js` `cacheNameFor()` (around 25–27, 109–149) |
| Boot success before first frame | One readiness flag covered core, renderer, and audio | `src/main.ts` readiness flags (around 97–183, 6874) |

---

## 5. Not run / skipped

These are deliberate omissions, not silent passes:

- **Full suite on Firefox and WebKit.** Those projects run the `@smoke` subset
  only, per the cross-browser smoke policy.
- **Full suite on mobile profiles.** Only `@mobile`-tagged tests run there.
- **Real Safari / real iOS or Android devices.** `mobile-webkit-emulation` is a
  Playwright WebKit build with an iPhone 13 viewport/touch profile; it is not
  device certification.
- **Perceptual audio/HRTF listening.** No headphones or measurement rig was
  available. Coverage is structural and numerical: graph topology, profile
  completeness, coordinate maths, listener conversion, fallback behaviour, and
  public API behaviour.
- **Live CDN audio playback.** Fixtures abort cross-origin requests, so the
  jsDelivr recordings are verified by configuration (URL, trims, crossfade,
  fallback) rather than fetched and played. Remote Opus channel counts remain
  unverified.
- **Two-build service-worker upgrade and stale-tab test.** Cache naming and
  lifecycle are unit-tested; the live A→B browser scenario was not added.
- **Real-time audio endurance and signal analysis.** No 10-minute preset run, no
  5-minute 5-track run, and no rendered-PCM clipping/DC/loop analysis. The 50
  start/stop cycles per preset and 5-track allocation are covered structurally.
- **CPU/RAM profiling and 1/3/5-track audio load.** Graph tests count nodes, but
  no runtime CPU/memory trace was captured.
- **Manual visual QA by a human.** Automated checks cover 320/390/768/820/1280/
  1440 widths, dark/light themes, reduced motion, and CPU-throttled first open;
  a human design review was not part of this pass.
- **Generated Theme Finder preview assets.** The CSS fallback is shipped; the
  preview generator was not run and no `public/theme-previews/` assets were
  committed.
- **Full repository ZIP.** The workspace is the full repository, but no ZIP
  artifact was created in this pass.
- **Lighthouse / Cloudflare Pages deployment.** Not part of this pass.
- **Svelte migration.** Not attempted; see Section 7.

---

## 6. Known limitations

- The workspace has no git metadata, so this report lists files by path rather
  than by diff. All changes remain uncommitted working-tree state.
- `deno test` and several Deno tool commands exit non-zero under PowerShell
  because Deno writes progress/`Check` lines to stderr. The rendered summaries
  are the authoritative result (`105 passed`, `95 passed`, etc.).
- Vite’s chunk-size warning is expected: optional modules are lazy, but the core
  clock/renderer/audio graph remains in the initial bundle.
- Cross-browser behaviour is verified on Playwright’s Chromium, Firefox, and
  WebKit builds. Older engine quirks outside those builds are not covered.
- HRTF quality is a sound-design judgment. Profile values are documented
  starting points, not measured HRIR data.
- Theme Finder previews currently rely on the designed CSS fallback because no
  generated captures exist in this checkout.

---

## 7. Svelte supplement — proposal only (not executed)

No Svelte code, dependency, or build change was introduced. If the team later
wants to evaluate it, the lowest-risk pilot is:

1. Mount **only the Theme Finder overlay** as a Svelte island behind the
   existing `SC.modals` / `applyTheme()` adapter.
2. Keep `sc_last_theme`, `sc_theme_favs_v1`, `sc_theme_recent_v1`, the card
   cache, and all DOM ids unchanged so Playwright and user data continue to work.
3. Measure bundle size, first interaction, and reduced-motion behaviour against
   the current vanilla implementation before considering a second surface.
4. Do not migrate `main.ts`, the renderer, or the audio graph in the pilot.

Decision for 2.0.0: **defer**. The vanilla TypeScript implementation remains the
source of truth.

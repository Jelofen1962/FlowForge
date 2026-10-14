# Cobweb code review

Scope: starter archive review, with emphasis on CI reliability, Windows-only build configuration, browser launch safety, and data/profile handling. The project has not been fully compiled in this environment because dependency installation did not complete within the available time. Treat the GitHub Actions run as the final build verification.

## Fixes applied

| Priority | Finding | Fix |
|---|---|---|
| P0 | `actions/setup-node@v4` used `cache: npm` without a lockfile, so the workflow failed before dependency installation. | Removed npm cache configuration until a lockfile exists. |
| P0 | CI matrix attempted Linux and macOS builds despite the Windows-only requirement. | Replaced the matrix with a single `windows-latest` job. |
| P1 | The workflow could report success if the installer bundle directory was missing. | Changed artifact upload to `if-no-files-found: error`. |
| P1 | DevTools debugging was not explicitly bound to loopback. | Added `--remote-debugging-address=127.0.0.1`. Keep the debugging port off the LAN. |
| P2 | Deleting the active profile changed React state but left `cobweb.activeProfile` in local storage pointing at the deleted profile. | Persist the fallback profile ID when deleting the active profile. |
| P2 | Immediate revocation of the export Blob URL could race the browser download. | Delay URL revocation briefly after triggering the download. |
| P2 | Numeric schema inference used `Math.min(...values)` / `Math.max(...values)`, which can throw for very large arrays due to argument limits. | Replaced spread calls with reductions. |
| P2 | README described a cross-platform workflow after the requested target changed. | Updated CI documentation to Windows-only and documented the missing lockfile. |

## Remaining issues, ordered by priority

| Priority | Finding | Impact / recommended next fix |
|---|---|---|
| P1 | No `package-lock.json` is committed. | `npm install` may resolve different dependency versions over time. Generate and commit the lockfile, then change CI to `npm ci` and re-enable `setup-node` npm caching. |
| P1 | Browser launch always requests port `9222`. | A second Cobweb instance or another Chrome process can occupy the port; concurrent runs can collide. Add port discovery and read the actual DevTools endpoint before CDP integration. |
| P1 | Workflow execution is still a demo simulation. | The UI advances through steps on timers; it does not execute click/type/wait/screenshot actions through CDP. Do not rely on run completion as proof that a workflow succeeded. Implement CDP runner and real step results. |
| P1 | Profile persistence toggles are UI-only. | The individual cookies/cache/localStorage/IndexedDB/session settings do not control Chromium storage. Implement and test CDP storage policies or label them as not yet active. |
| P2 | URL validation in Rust checks only the `http://` / `https://` prefix. | Malformed URLs can pass validation and fail at browser launch. Parse URLs with a URL parser and require a valid host. |
| P2 | Browser process lifecycle is incomplete. | Launching again replaces the tracked `Child` without explicitly terminating or managing the prior process. Add stop/restart handling and cleanup on app exit. |
| P2 | JSON query semantics differ between the frontend and Rust commands. | Frontend supports regex and string-coerced equality; native query currently lacks regex and uses strict JSON equality. Document or unify semantics and add tests. |
| P2 | The JSON inspector reads all records into memory. | Very large JSON/NDJSON files can freeze or exhaust WebView memory. Move ingestion/query to streaming Rust workers with limits and cancellation. |
| P3 | Some UI actions are placeholders (for example, save draft, site creation, performance export, and page preview). | Connect these controls to persistence and real data, or label them consistently as demos. |

## Validation status

- Workflow YAML and paths reviewed statically.
- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` did not complete within the available time, so no lockfile was generated.
- Full TypeScript/Tauri build and runtime tests remain unverified in this environment.


## Follow-up build failure: missing Windows icon (2026-10-13)

- **P0 (fixed):** Tauri's Windows resource build requires `src-tauri/icons/icon.ico`. The file was absent, so `tauri-build` stopped before compiling the app. Added a valid multi-resolution Windows ICO and a matching PNG, and declared both in `bundle.icon` in `src-tauri/tauri.conf.json`.
- **P2 (fixed):** Narrowed artifact upload paths to the Windows NSIS `.exe` and MSI `.msi` installer outputs so the workflow only publishes Windows installer artifacts.
- **Verification:** The icon files and configuration were checked locally, but a full GitHub-hosted Windows build has not yet been run after this fix.


## Production-hardening follow-up

- **P1 (implemented):** Windows-only CI prepares and uploads `Cobweb.exe` as a standalone x64 executable and publishes the NSIS installer separately.
- **P1 (implemented):** Workflow drafts persist in local WebView storage and workflow JSON export creates a downloadable versioned JSON file.
- **P2 (implemented):** UI scale set to 125%; default window size increased; reduced-motion preference honored.
- **P0 (still open):** Actual automation steps are not yet executed through Chrome DevTools Protocol. The runner is still a prototype and must not be represented as production-ready.
- **P1 (still open):** Recorder, real browser preview, and performance telemetry are placeholders/sample data.
- **P1 (still open):** `npm install` remains because a committed lockfile is absent. Add and review `package-lock.json`, then switch CI to `npm ci`.
- **Verification:** Source/configuration edits were inspected, but a full Windows CI build and runtime test have not been executed in this environment.


## UI reliability and test-suite pass

- Added a reusable keyboard-accessible dropdown menu with outside-click and Escape dismissal, disabled actions, and callback-driven menu items.
- Wired workspace, engine, help, account, and per-step menus to actions. Added Settings and Keyboard Shortcuts pages rather than leaving those navigation items blank.
- Added gentle menu/panel transitions, button feedback, hover motion, focus rings, and reduced-motion support.
- Extracted workflow validation, draft parsing, safe filenames, URL validation, JSON/NDJSON parsing, nested path lookup, and query filters into `src/workflow.ts`.
- Added Vitest unit tests for the shared workflow/data utilities and dropdown behavior.
- Added Rust unit tests for JSON/NDJSON parsing, nested/array paths, query operators, and unknown-operator fail-closed behavior.
- GitHub Actions now runs `npm test` and `cargo test` before building the app.
- **Coverage limitation:** this is broad unit coverage of shared pure logic and the menu component, not a claim that every UI screen, Tauri command, browser interaction, and OS edge case has full automated coverage. The actual CDP automation runner remains a separate production blocker.


## Test and interaction reliability follow-up

- **Fixed:** Menu controls now render a reusable dropdown with real actions, Escape dismissal, outside-click dismissal, keyboard semantics, and visible hover/focus states.
- **Fixed:** Workflow title, steps, starting URL, headless mode, and live-debugging preference are persisted in local WebView storage.
- **Fixed:** Websites added through the dialog are saved locally and appear in the website list; website menus select, copy, or remove custom targets.
- **Fixed:** Step menu actions duplicate, enable/disable, and delete steps. Group menu can collapse/expand and enable/disable all steps.
- **Added:** Frontend tests cover draft validation, filename safety, URL validation, JSON/NDJSON parsing, nested paths, query operators, dropdown behavior, menu navigation, site persistence, step duplication, and draft updates.
- **Added:** Rust tests cover JSON inspection, nested paths, query projection/pagination, parser errors, filtering, and fail-closed handling of unknown operators.
- **CI:** Frontend and Rust test commands run before the Windows bundle build.
- **Not verified locally:** npm dependency installation timed out; Rust tooling is not installed in the available environment. GitHub Actions must confirm type checking, test pass status, and the final Windows build.
- **Still a P0 product gap:** Browser automation steps themselves are not yet executed through CDP; the runner/preview remain prototype behavior. UI tests do not establish that browser automation is production-ready.


## npm registry 404 follow-up (2026-10-13)

- **Fix:** added an npm override pinning transitive `rollup` to `4.34.8`, avoiding the unavailable `rollup-4.64.6.tgz` tarball reported by the Windows runner.
- **Fix:** dependency installation uses `--prefer-online` so npm favors fresh registry metadata over stale local cache metadata.
- **Note:** a successful install/build still needs to be confirmed by GitHub Actions. A committed `package-lock.json` should be generated with a successful `npm install` and committed in the repository to make dependency resolution reproducible.

## Phase 4 Priority 1 update (execution controls)

The workflow runner is now asynchronous from the desktop UI and communicates structured step/state/finish events. Pause is cooperative at step boundaries, configured breakpoints pause before their step in live-debug mode, resume releases the pause gate, and stop races in-flight work against a cancellation signal. The builder surfaces Pause/Resume and Stop controls, and F6/F8/Shift+F8 keyboard controls are wired.

Browser-backed integration tests live in `tests/runner.integration.test.mjs`. They exercise navigation, form interaction, breakpoint pause/resume, and cancellation against a local fixture page. These tests require `COBWEB_TEST_BROWSER` to point at a Chromium-family browser executable; they are skipped when that environment variable is not configured. This environment did not have the project dependencies or a Rust toolchain available, so a full TypeScript build and Rust compilation remain unverified here.

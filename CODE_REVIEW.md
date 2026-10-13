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

# Cobweb bug analysis and fix report

Date: 2026-10-13

## Fixes applied

| ID | Severity | Finding | Change |
|---|---|---|---|
| FIX-01 | High | Settings controls were uncontrolled (`<select>` had no `value`, numeric fields used `defaultValue`) so edits were not represented by application state. | Added controlled preferences state for browser engine, timeout, DevTools port, and optimization toggles. |
| FIX-02 | High | The Save settings button only displayed a toast and did not write preferences to storage. | Persist preferences to `localStorage` under `cobweb.preferences.v1`; save button also writes synchronously and reports storage failures. |
| FIX-03 | High | Browser selection did not affect the backend launch command. | Pass the selected browser engine and DevTools port to the Tauri command. |
| FIX-04 | High | Edge was not the default, and Windows launch relied on executable names in PATH (`chrome`, `msedge`, `chromium`), which commonly fails for installed desktop browsers. | Edge is now the default. Windows launcher checks standard Edge install paths before PATH fallbacks; Chrome/Chromium are selectable explicitly, and Chromium checks common install paths. |
| FIX-05 | Medium | DevTools port was hard-coded to 9222 in the launcher despite a UI setting. | Launcher accepts the configured port and validates it is within 1024–65535. |
| FIX-06 | Medium | No regression test covered browser preference defaults or persistence. | Added a frontend test for Edge default and persistence of browser engine/port. |

## Bugs confirmed but not fully fixable without completing the browser automation layer

| ID | Severity | Finding | Current status / next fix |
|---|---|---|---|
| OPEN-01 | Critical | Workflow execution is a timed preview simulation. It does not execute click/type/navigation/assertion steps against the launched browser. | Must connect to Chrome DevTools Protocol (CDP), map each step type to a CDP action, and report per-step success/failure. This is a larger missing feature, not a small UI bug. |
| OPEN-02 | Medium | A live browser preview cannot be guaranteed for every website because many sites send anti-iframe headers. | Replaced the static placeholder with a live URL iframe, made refresh remount/reload it, and made the external-link control launch the selected browser. Sites that block embedding still require the external browser or a future CDP-backed preview. |
| OPEN-03 | High | Back, forward, and reload are offered as workflow step types but have no real browser executor. | Implement these via CDP (`Page.navigateToHistoryEntry`, `Page.getNavigationHistory`, `Page.reload`) once the CDP connection exists. |
| OPEN-04 | High | Page optimization switches are only preferences. CSS/fonts/images/media blocking and reduced-motion injection are not wired into a browser session. | Apply persisted flags using CDP Network interception and `Page.addStyleTag`/emulation before the workflow begins. |
| OPEN-05 | Medium | The default timeout preference is saved, but existing per-step wait configuration remains a separate UI field and does not drive execution yet. | Once step execution exists, resolve timeout precedence: per-step override, then global default. |
| OPEN-06 | Medium | Profile persistence options in the Profiles page are UI-level settings and are not applied to browser storage/cache policies. | Wire each profile to its own stable user-data directory and enforce the selected persistence behavior; current directory isolation alone does not implement every policy toggle. |
| OPEN-07 | Medium | Browser child process is stored as one optional child. Repeated launches can overwrite the tracked child and the configured port can conflict with another process. | Before launching, check/terminate or reuse the existing child, probe the requested port, and return actionable diagnostics. |
| OPEN-08 | Medium | Workflow run state uses timers and can finish even if browser launch fails; the simulation can mislead users into thinking steps ran. | Separate “launch browser” from “execute workflow”; abort execution on launch failure and only mark steps successful after CDP confirms completion. |

## Validation performed

- Source-level review of the React settings/run flow and Tauri browser launcher.
- Replaced the static preview mock with an iframe preview and made its refresh button reload the current URL; sites that forbid iframe embedding may still require opening in Edge.
- Added a regression test for preference default and persistence.
- Full frontend build/test and Rust compilation could not be run in this environment: `npm install` did not complete before timeout, and `cargo` is not installed in the execution environment. The CI workflow should run `npm test`, `npm run build`, and `cargo test` on the next push.

## Important limitation

This patch fixes preference persistence and Edge selection/launch discovery. It does **not** claim that Cobweb's workflow actions or static browser preview are now functional; those features require the CDP integration listed above.

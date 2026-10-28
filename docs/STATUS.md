# FlowForge status snapshot

Date: 2026-10-28

## Current evidence

Release risk: the dependency manifest uses initial compatibility versions (including Electron 33) and must be refreshed to a currently supported Electron release once npm access is available, then retested. Do not ship an installer from these pins without that upgrade/review.

| Check | Result | Evidence / limitation |
|---|---|---|
| Repository audit | Complete for available workspace | No existing FlowForge repository was present; this is a new foundation |
| TypeScript syntax transpilation | Pass | 14 TypeScript/TSX source and test files transpiled with global TypeScript |
| JSON/expressions/batch smoke tests | Pass | Pure utility checks executed with Node against transpiled modules |
| package.json parse | Pass | Parsed with Node JSON parser |
| npm dependency install | Blocked | Online install timed out; offline install failed with `ENOTCACHED` |
| Vitest suite | Blocked | `npm test` returned `vitest: not found` because dependency installation was blocked |
| Strict TypeScript type-check | Not verified | Local `tsc` cannot resolve project type packages (`vite/client`, `vitest/globals`, `node`) without npm dependencies |
| ESLint | Not run | Dependencies unavailable |
| Vite production build | Not run | Dependencies unavailable |
| Electron launch | Not run | Dependencies unavailable; this environment is Linux |
| Windows packaging / install / uninstall | Not run | Requires Windows runner and installed dependencies |

## Review passes

### Review A: architecture, correctness and security

- Added strict sender checks to IPC and constrained file inputs/outputs.
- Restricted URL navigation, enabled Electron context isolation and disabled renderer Node integration.
- Added graph schema validation, bounded graph size, cycle detection, one-start-node validation, topological execution order and safe expression path resolution.
- Confirmed browser actions use a managed Selenium session and only allow HTTP(S) navigation.
- Review fix: removed duplicate schema parsing from the run IPC path; merged graph paths now execute only after all predecessors, and a regression test covers the case.
- Remaining blockers: full type-check/build unavailable; action execution cannot interrupt an in-flight WebDriver command (cancellation is honored between actions); conditional and loop execution is not implemented; browser runtime has not been exercised in this environment.

### Review B: UX, recorder reliability, accessibility and batch safety

- Recorder selection is cancellable with Escape, removes injected overlay/listeners after selection/timeout, and prevents the Alt+click from triggering the page click.
- Locator match counts are shown; unsupported action types are disabled in the action library.
- JSON parse errors and batch row failures are surfaced; batch retries are bounded.
- Review fix: adding a picked click action now inserts it into the selected node's outgoing path instead of accidentally creating a parallel branch. DOM text/link extraction uses bounded single-script queries rather than per-element WebDriver round trips.
- Remaining blockers: recorder action capture is limited to element selection-to-click-node conversion; no keyboard navigation/E2E audit was possible; history/resume and true nested loops remain unimplemented.

These were two separate model review passes, not independent human approvals. No human reviewer approval is claimed.

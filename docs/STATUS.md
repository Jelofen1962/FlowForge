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


## 2026-10-28 quality-fix pass

- Fixed the reported React JSX runtime warning by importing `StrictMode` from React.
- Removed the `Workflow` icon/type name collision by aliasing the Lucide icon to `WorkflowIcon`.
- Explicitly typed React Flow edge state.
- Split Vitest configuration into `vitest.config.ts` and kept `vite.config.ts` on Vite's own `defineConfig` type to avoid Vite/Vitest config overload conflicts.
- Simplified the CSS selector escaping branch to use the standard `CSS.escape` API.
- Upgraded GitHub Actions checkout/setup-node to v5, which uses the Node 24 action runtime and addresses the Node 20 deprecation warning.
- Verification limitation: `npm install --no-audit --no-fund` timed out in this environment, so full typecheck, lint, test, and build results remain unverified here.

**Current phase:** Phase 1 quality/build-blocker fixes, with Phase 2 (graph editor and graph schema) already partially implemented. Phase 1 is not complete until CI checks pass.


## Phase 2 start: connected graph execution

- Added an executable `if` action with `equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`, and `isTruthy` operators.
- Conditional nodes now expose real React Flow `true` and `false` source handles; outgoing edges select the matching branch. Nodes outside the chosen branch are not executed.
- Added an inspector dropdown for condition operators and condition-specific defaults when creating a node.
- Disabled nodes now pass execution through to their connected successors instead of silently cutting the workflow path.
- Added regression tests for conditional routing, merge paths and disabled-node pass-through; added schema validation for invalid conditional source handles.
- Verification: global TypeScript transpile syntax check passed for 15 source/test files. `npm test` is blocked (`vitest: not found`) and strict typecheck is blocked because project dependencies/types are not installed. No runtime/test pass is claimed.

**Current phase:** Phase 2, graph editor and execution semantics (in progress). Phase 1's full CI gate remains an outstanding release blocker.


## Phase 2 completion pass (2026-10-28)

- Added bounded `forEach` execution with nested inline action lists, item/index expressions, cancellation checks, and a 10,000-item hard ceiling.
- Added canvas undo/redo (up to 100 snapshots), keyboard shortcuts, selected-node copy/paste with internal connections, and logical node grouping by name.
- Added per-node execution result styling and distinct item/done loop ports.
- Strengthened schema validation for conditional and loop connection handles; added regression tests for nested loops and invalid handles.
- Verification is still blocked by missing npm dependencies. The implementation is not release-verified until typecheck, Vitest, ESLint, and production build pass.


## Phase 3 start: browser action recording (2026-10-28)

- Fixed the reported ESLint `no-unused-expressions` error in the undo/redo keyboard shortcut by using explicit `if/else` branches.
- Added a one-action recorder in the managed Chrome session for click and text-input change events. It captures a CSS locator, action kind, tag name, and text value where applicable; Escape cancels and capture times out after 60 seconds.
- Exposed recording through a trusted IPC handler and preload API; added a Recorder toolbar button that inserts the captured action as a workflow node and reconnects the selected node's downstream path.
- Verification: 13 TypeScript/TSX files transpiled with zero syntax diagnostics. Full ESLint, strict typecheck, tests, and build are still unverified because project dependencies are not installed in this workspace. The recorded action capture has not been runtime-tested against Chrome.
- Remaining Phase 3 work: select-option capture, navigation recording, role/name locators, iframe behavior, and Chrome runtime integration tests.


## Phase 4 start: bounded structured scraping (2026-10-28)

- Added `extractItems`, which extracts named fields from repeated CSS-selected containers, caps each page at 500 containers and total output at 10,000 rows, suppresses duplicate rows, and supports optional bounded pagination (maximum 100 pages).
- Added the action to the workflow schema, registry, and action library with starter field configuration.
- Fixed the reported TypeScript inference issue by renaming the DOM ancestor variable and explicitly asserting its nullable element type.
- Verification: full npm typecheck/lint/tests/build are not claimed because dependencies remain unavailable in this environment.
- Remaining: dedicated extraction schema editor/preview and pagination/runtime tests.


## Phase 4 follow-up

- Added a visual extraction-field editor to the node inspector. Users can add/remove output fields and edit each field name and CSS selector without editing the fields JSON directly.
- Live browser preview and pagination integration tests remain outstanding. Full project checks remain blocked while dependencies are unavailable.

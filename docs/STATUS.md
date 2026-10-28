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


## Phase 6 start: variable editor and reusable workflow library (2026-10-28)

- Replaced the placeholder variable panel with editable workflow variables (name, type, default value, add/remove). Workflow variables now serialize with the graph and load from saved workflows.
- Added a local reusable-workflow library backed by renderer localStorage. Users can save a copy of the current workflow, load a saved workflow, or remove it from the library.
- Scope is deliberately limited: library workflows can be reopened/reused as starting points, but calling a library workflow as a subworkflow node, shared cross-project storage, secret masking/environment injection, and version/dependency tracking are not implemented yet.
- Full npm typecheck/lint/tests/build remain unverified because dependencies are unavailable.


## Phase 7 start: data export and loop safety (2026-10-28)

- Added an `Export CSV` workflow action that writes arrays of row objects to a `.csv` file using the existing CSV encoder and atomic temporary-file rename. Output filename and 50 MB size are validated.
- Added a 10,000-total-iteration ceiling shared across nested `forEach` actions, preventing nested-loop multiplication from running unbounded. Loop cancellation is checked between iterations and signals are passed to nested handlers.
- Added a regression test for the nested-loop ceiling.
- Verification: pending syntax transpilation; full npm typecheck/lint/tests/build remain blocked by unavailable dependencies.
- Remaining Phase 7 work: bounded concurrency for safe non-browser batch tasks, in-flight WebDriver cancellation, and resume checkpoints.


## Phase 8 start: durable run summaries

- Added main-process run-history persistence under the app's user-data directory. Each run records workflow name, start time, duration, status, step count, and a bounded error message; the history is atomically replaced and capped at 50 entries.
- Added a trusted IPC read method and a Runs panel list. Workflow variable values and execution logs are intentionally excluded from history.
- Hardened workflow-run input sizing against non-serializable values and ensured unexpected execution errors become a failed/cancelled result rather than escaping the run handler.
- Remaining: breakpoints, recovery checkpoints, accessibility/E2E coverage, dependency refresh, and Windows packaging validation.
- Verification limitation: dependencies are unavailable in this environment; only syntax transpilation and archive integrity can be checked here. No full typecheck, test, lint, build, or installer success is claimed.


## Phase 9 start: reusable workflows and scraping preview

- Added subworkflow execution with input mapping, output-variable capture, cancellation/error propagation, and a 10-level nesting ceiling.
- Added a library selector in the node inspector; the selected workflow definition is embedded into the node configuration for portability.
- Added current-page extraction preview via trusted IPC; preview does not click pagination controls.
- Added a subworkflow regression test.
- Verification: 15 TypeScript/TSX files transpiled without syntax diagnostics. Full typecheck, test suite, lint, and production build remain unverified because dependencies are unavailable.


## Phase 9 completion pass

- Recorder captures HTTP(S) anchor navigation as `openUrl`, native select changes as `selectOption`, text edits as `typeText`, and ordinary clicks as `click`.
- Added `selectOption` and `extractImages` workflow actions. Image output includes resolved source, alt/title, dimensions, loading mode, and completion state, with a 2,000-image cap.
- Element picker offers XPath candidates based on accessible name text, `aria-label`, and `title` in addition to CSS/XPath paths and IDs.
- Workflow preflight validates required browser selectors, select values, extraction field maps, pagination limits, and loop bounds. Added regression tests for invalid selector/config handling.
- Verification caveat: dependency-backed tests, lint, full type-check, build, and live Chrome integration are still required before Phase 9 can be declared fully verified.

## Phase 10 reliability pass (2026-10-28)

- Fixed loop-budget state leaking across executions when the same `ActionRegistry` is reused. The counter is now created per run and explicitly shared with nested subworkflows, preserving the total 10,000-iteration ceiling within each run.
- Added a regression test that executes a 10,000-iteration workflow twice with the same registry.
- Verification remains partial in this workspace: Vitest is not installed, so the new regression test and full suite cannot be run here. TypeScript syntax transpilation and archive integrity are checked separately; CI must still confirm typecheck, tests, lint, build, and Chrome integration.

- Phase 10 follow-up: cancellation is now checked before every inline loop action, preventing later actions in the same iteration from running after an earlier action requests cancellation. Added a regression test asserting the workflow returns `cancelled` and the following action is skipped. Full Vitest/typecheck/lint/build remain unverified until dependencies are installed.

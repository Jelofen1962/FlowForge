# Phase 1: baseline and architecture audit

Date: 2026-10-29  
Scope: source snapshot at `278b9c2` (`fix type`), FlowForge Desktop 1.1.7.

## Executive summary

The repository is a compact Electron + React + TypeScript application with a real workflow executor, a Selenium-backed browser service, typed preload API, schema validation, local workflow persistence, and a meaningful set of workflow/browser tests. Phase 1 does **not** justify a wholesale rewrite. Keep the current stack and improve the highest-risk seams incrementally.

**Phase 1 status: audit completed; green baseline not established.** The source snapshot has no `node_modules` and no committed `package-lock.json`. The quality commands were attempted, but typecheck, tests, lint, and build cannot currently run to completion in this environment. Do not describe the current branch as release-verified until those gates pass in CI.

## Baseline evidence

| Check | Result | Evidence |
|---|---|---|
| Repository / commit | Inspected | `278b9c2 fix type`; working tree clean before audit notes |
| Runtime versions | Available | Node `v22.16.0`, npm `10.9.2` |
| Dependency install | Not run successfully | `node_modules` absent; network dependency install is outside this baseline pass |
| `npm run typecheck` | Blocked | TS2688: missing `vite/client` and `vitest/globals` type definitions |
| `npm test` | Blocked | `vitest: not found` |
| `npm run lint` | Blocked | `eslint: not found` |
| `npm run build` | Blocked | Stops at the same missing type definitions during typecheck |
| Chrome integration | Not run | Vitest dependencies and browser environment are not installed/verified |
| Windows package/install | Not run | Requires Windows runner and dependency-backed build |

Existing tests are present in `tests/workflow.test.ts`, `tests/jsonFields.performance.test.ts`, and `tests/chrome.integration.test.ts`. The workflow suite covers validation, ordering, conditional branches, loops, cancellation, subworkflow mapping, and batch/data helpers. The browser suite covers managed-browser actions, element selection, and repeated-item extraction. These tests are useful regression assets, but their current passing status is **unknown** until executed.

## Current architecture map

- **Renderer:** `src/renderer/App.tsx`, `src/renderer/styles.css`. React and React Flow own the editor and local UI state.
- **Privileged process:** `src/main/index.ts`. Electron window lifecycle, IPC handlers, file dialogs, persistence, workflow runs, and browser controls.
- **Preload boundary:** `src/preload/index.ts` exposes a typed `window.flowforge` API; contracts live in `src/shared/ipc.ts`.
- **Workflow runtime:** `src/workflow/schema.ts`, `src/workflow/engine.ts`, `src/workflow/expression.ts` validate and execute graph definitions.
- **Browser automation:** `src/automation/chromeSession.ts`, `src/automation/actions.ts`, `src/automation/browsers.ts` manage Selenium sessions and browser action handlers.
- **Data utilities:** `src/data/*` handles batch work, formats, JSON field inspection, and worker support.
- **Quality gate:** `.github/workflows/ci.yml` defines typecheck, tests, Chrome integration, lint, build, and a dependent Windows packaging job.

## Findings, ranked

### P1: reproducible installs and verified baseline

1. **No committed lockfile.** `package.json` has ranged dependencies and CI runs `npm install`. A later install can resolve a different dependency graph. Generate a lockfile using a network-enabled, supported Node/npm environment, review it, then switch CI to `npm ci` in a dedicated change.
2. **The quality baseline is not green or evidenced here.** Existing docs already mark full verification as pending, and this run reproduced dependency-related blockers. The first engineering gate is a complete CI run with retained logs, not more feature work.
3. **Electron dependency is pinned to major 33.** Review currently supported Electron versions and security fixes before a release upgrade; upgrade deliberately with browser and packaging regression checks rather than bumping blindly.

### P1: workflow execution contract

4. **Execution is mostly a topological pass with active-node routing.** `src/workflow/engine.ts` builds a topological order once, then marks nodes active as predecessors execute. This supports the current branch/merge semantics, but true iterative graph loops, breakpoints, durable resume, and retry/try-catch semantics are not present. Keep those as explicit future capabilities, not implicit promises.
5. **Step and loop limits exist, but resource budgets are not comprehensive.** The runtime caps steps and total inline loop iterations; input workflows and files also have size caps. Add tests and limits for accumulated log/output size and expensive extraction results before allowing larger workflows or higher concurrency.
6. **Cancellation has a browser-specific global side effect.** The main process abort handler stops the shared `chromeSession`, consistent with the current single-run constraint. Preserve that constraint until session ownership is per-run; otherwise one run could cancel another run's browser work.

### P1: browser automation reliability

7. **Browser state is a shared singleton.** `chromeSession` is process-wide and the main process currently rejects concurrent runs. This is a valid stability choice for now. Avoid adding parallel browser execution until session ownership, teardown, and cancellation are isolated.
8. **Recorder scope is one action at a time.** The existing recorder captures selected interactions and candidate locators, but pause/resume, robust multi-step recording, iframe coverage, and end-to-end record/replay against representative dynamic pages remain unverified/incomplete per existing status notes.
9. **Chrome integration tests are environment-sensitive by nature.** Keep them on local deterministic fixtures, run them in CI with a known Chrome setup, and report them separately from unit tests.

### P1: responsive UX and maintainability

10. **The main workspace is not yet genuinely responsive.** The stylesheet has a desktop three-column workspace breakpoint at 1250px, while the 700px breakpoint only adapts the home dashboard. The editor's left/right panels and canvas need an explicit compact-width interaction model (collapsible drawers or tabs) before claiming full responsiveness.
11. **Global `html { zoom: 1.25; }` is a fragile layout workaround.** It changes effective sizing across the entire renderer and can magnify overflow/zoom inconsistencies. Remove it as part of the design-system/layout pass after replacing its intended sizing benefits with deliberate type and spacing tokens.
12. **Renderer CSS and JSX are difficult to review.** `src/renderer/styles.css` is highly compressed, and `App.tsx` contains dense inline JSX/configuration logic. Refactor only when touching the affected UI: format styles, extract repeated field controls into a small component where that reduces duplication, and keep the state model simple. Do not split files merely to satisfy an arbitrary file-size rule.
13. **Renderer behavior lacks component-level coverage.** Current tests focus on workflow/data behavior and browser integration. Add a small set of renderer tests for workflow save/load failure, run/cancel states, empty states, and inspector edits as the redesign changes these flows.

### P2: security and persistence follow-up

14. **Positive security foundations are already present.** Renderer Node integration is disabled, context isolation is enabled in the Electron window configuration, IPC handlers check the sender/main frame, workflows are schema-validated, and writes use same-directory temporary files followed by rename. Keep these as invariants during refactoring.
15. **Typed preload signatures are compile-time contracts, not runtime validation.** IPC payload validation in main is the actual trust boundary. Keep validation there even if renderer types become more precise.
16. **Workflow files are schema-versioned, but migration behavior needs an explicit policy.** Preserve existing `schemaVersion` compatibility and add migration tests before changing the workflow shape. Avoid destructive auto-upgrades; keep an original backup or make migrations reversible where practical.

## UX baseline

- **Primary task:** build, configure, and run a browser/data workflow from a node graph.
- **Current strengths:** dedicated canvas, action inspector, browser controls, element picker/selector feedback, workflow library, JSON/data utilities, and execution feedback already exist.
- **Main friction:** the app exposes many capabilities in a dense desktop workspace; panel behavior at narrow widths is underdeveloped; inspector controls are generic for many node types; and renderer state is concentrated in one large component.
- **Redesign acceptance:** desktop-first editor with collapsible side panels; narrow windows switch panels to drawers/tabs instead of squeezing the canvas; clear run/stop status; visible selector confidence/match count; keyboard/focus support; and explicit loading, empty, error, and success states. Keep the canvas as the primary focal area.

## Recommended sequence after Phase 1

1. Get the current source passing all CI gates without broad refactors.
2. Add a real lockfile and reproducible dependency installation.
3. Fix any failures exposed by the green-baseline attempt and add focused regression tests.
4. Establish renderer behavior tests and a responsive-layout acceptance checklist.
5. Begin the design-system/UI refactor and runtime changes as separate, reviewable increments.

## Explicit non-goals for this audit

- No new dependencies or speculative architecture layers.
- No wholesale rewrite of the workflow engine or Electron shell.
- No claim that unavailable tests passed.
- No change to workflow file format before migration tests exist.

## Verification retry addendum (2026-10-29)

A second dependency-install attempt (`npm install --ignore-scripts --no-audit --no-fund`) timed out after 120 seconds and did not produce `node_modules` or a lockfile. The following checks were then run against the available source:

| Check | Result | Evidence / limitation |
|---|---|---|
| TypeScript syntax transpilation | Pass | 19 `.ts` / `.tsx` source and test files; zero transpile diagnostics using the globally available TypeScript compiler |
| Dependency-free utility smoke tests | Pass | CSV parse/encode, expression resolution and prototype-path rejection, and batch retry behavior |
| `package.json` parsing | Pass | Valid JSON |
| `npm run typecheck` | Blocked | Missing `vite/client` and `vitest/globals` type definitions |
| `npm test` | Blocked | `vitest` executable unavailable |
| `npm run lint` | Blocked | `eslint` executable unavailable |
| `npm run build` | Blocked | Stops at the same missing type definitions |

**Decision:** do not start broad Phase 2 UI work yet. The audit and source-level smoke checks are complete, but Phase 1's dependency-backed green baseline remains open. Resolve registry access or run the existing CI workflow in a network-enabled environment; capture actual logs before declaring the gate green. No lockfile was fabricated and no runtime behavior was changed.

# FlowForge implementation plan and acceptance checklist

## Architecture

- Electron main owns window lifecycle, persistence, dialogs and privileged operations.
- Preload exposes a small typed API; renderer Node integration remains disabled.
- React/React Flow owns graph editing only. The versioned workflow schema and registry own execution semantics.
- Selenium browser operations run in the main process through a managed Chrome session.
- Data utilities are pure TypeScript where possible.

## Milestones

- [x] Foundation: Electron shell, React/Vite/TypeScript, secure IPC starter, graph schema, action registry, expression resolver, JSON field detector, sequential batch helper, initial unit tests.
- [x] Initial graph editor and manual workflow persistence.
- [x] Selenium session lifecycle, navigation, basic browser action handlers, Alt+click element picker, overlay and locator tests implemented in source.
- [x] JSON/CSV/TXT field inspection helpers and JSON/CSV/TXT field-report export.
- [ ] Phase 1 verification: dependency install, strict typecheck, tests, lint and production build.
- [x] Phase 2 graph (initial increment): explicit true/false conditional routing, condition operators, real React Flow connection handles, disabled-node pass-through, branch regression tests.
- [x] Phase 2 graph: bounded nested loops (inline action lists), undo/redo, node clipboard, logical grouping, run-state visualization, conditional/loop handle validation.
- [ ] Phase 2 verification gate: install dependencies, strict typecheck, tests, lint and production build.
- [ ] Phase 3 browser: runtime lifecycle tests; select-option and navigation capture; role/name locators and iframe behavior.
- [x] Phase 3 browser (initial increment): record one click or text-input change from the managed Chrome session and insert it as a connected workflow node.
- [x] Phase 4 scraping (initial increment): bounded repeated-item extraction with field selectors, duplicate-row suppression, optional pagination and workflow-variable output.
- [x] Phase 4 scraping: visual extraction schema editor for named fields and CSS selectors.
- [ ] Phase 4 scraping: live preview UI and pagination integration tests.
- [x] Phase 5 initial increment: visual extraction-field editor. Live preview and pagination tests remain.
- [ ] Phase 6 variables/library: editable workflow variables and locally persisted reusable-workflow library started; subworkflow invocation, secret/environment handling and dependency/version tracking remain.
- [x] Phase 7 data/batch (initial increment): Workflow-level CSV export action and a 10,000-total-iteration ceiling across nested loops. Existing loops already check cancellation between iterations.
- [ ] Phase 7 remaining: bounded concurrency for non-browser batch tasks, cancellation of in-flight browser commands, and resume checkpoints.
- [x] Phase 8 reliability/release (initial increment): durable, capped run-summary history stored atomically; renderer displays the latest 50 summaries without persisting variable values or logs.
- [ ] Phase 8 remaining: breakpoints, resume/recovery checkpoints, broader accessibility review, integration/E2E tests, dependency refresh and Windows installer validation.

## Acceptance criteria

1. Strict type-check, lint, tests and production build pass.
2. Workflow imports are schema-validated; invalid inputs never execute.
3. IPC methods are allowlisted and validate untrusted arguments.
4. Graph execution follows connections, reports failures and supports cancellation.
5. Browser work uses managed sessions with cleanup; no simulated success is presented as real browser work.
6. Batch results retain per-record success/failure and retry counts.
7. JSON field detection reports nested paths, array shapes and observed types.
8. Windows package starts, persists data, manages Chrome, and uninstalls cleanly on Windows.

## Review log

- Review A: separate architecture/correctness/security pass recorded in `docs/STATUS.md`.
- Review B: separate UX/recorder/batch-safety pass recorded in `docs/STATUS.md`.
- Independent human reviewers are not available in this execution context; no human approvals are claimed.

## Phase 9 start: feature completion increment

- Implemented a real `subworkflow` action: a node can embed a saved workflow, pass resolved input variables, receive child variables as its result, propagate cancellation/errors, and stop recursive nesting at 10 levels.
- Added a reusable-workflow picker to the node inspector, using the existing local workflow library. Selected workflows are embedded in the parent node so it remains portable after saving.
- Added a current-page scraping preview that uses the configured item selector and field map without triggering pagination.
- Added a regression test for subworkflow input/output behavior.
- Phase 9 completion increment: recorder now captures HTTP(S) link navigation and native select changes; a select-option action executes native `<select>` values with explicit missing-option errors.
- Added image extraction for source/current source, alt text, title, natural dimensions, lazy-loading metadata, and completion state.
- Added accessible-name XPath candidates to the element picker, covering text, `aria-label`, and `title` when present.
- Added preflight validation for required browser configs, extraction field maps, pagination bounds, and loop item limits, plus regression tests.
- Phase 9 status: implementation scope is covered in source; release-grade completion remains pending full dependency-backed typecheck, test, lint, build, and real Chrome integration runs.

## Phase 10: execution reliability and regression hardening

- Moved the 10,000-iteration loop budget from registry lifetime to an individual workflow run. Reusing an action registry no longer causes later runs to inherit prior iteration usage.
- Shared the same iteration budget with nested subworkflow calls so nesting cannot reset the safety ceiling.
- Added a regression test that runs a 10,000-iteration workflow twice with the same registry and expects both independent runs to succeed.
- Phase 10 verification gate: run dependency-backed tests, strict typecheck, lint, production build, and a real-browser smoke test in CI before calling the phase release-verified.


## Phase 10 reliability follow-up

- Cancellation requests now stop the managed Chrome session to interrupt in-flight browser actions; final cleanup handles a browser startup that races with cancellation.
- Validate with a real Chrome integration test and the full CI gate before treating cancellation as release-ready.


## Phase 11: browser integration and CI confidence

- Added a local-fixture integration test for managed Chrome navigation, DOM extraction, links, select-option changes, image extraction, and shutdown.
- CI provisions Chrome and runs this smoke test without relying on external websites.
- Acceptance gate remains: full CI quality job and Windows packaging job must pass; no release verification is claimed from syntax-only checks.


## Phase 12: CI and build stabilization

- [x] Declare supported Node/npm engine versions.
- [x] Add CI job timeouts and quieter dependency-install logs.
- [x] Ensure browser-test cleanup closes the local fixture server even when browser cleanup fails.
- [x] Reconcile README implementation notes with the implemented Phase 9-10 source changes.
- [x] Run the GitHub Actions CI workflow and resolve failures. The project owner reports the workflow completed without errors; this environment cannot independently inspect the remote run.
- [x] Keep CI's dependency installation aligned with the currently passing workflow (`npm install`).

**Phase 12 complete based on the reported green GitHub Actions run.** A committed registry-resolved `package-lock.json` and switching to `npm ci` remain recommended reproducibility improvements, not a claim about the currently passing pipeline. Do not hand-author a lockfile; generate and review it in a network-enabled environment as a separate hardening change.

## Phase 13: browser recorder and scraping completion

- [x] Improve stable CSS/XPath locator candidate generation and expose unique-match counts.
- [x] Add real-browser integration coverage for element picking, action recording, and two-page repeated-item extraction.
- [x] Make the existing image-extraction action discoverable from quick tools.
- [ ] Confirm the expanded Chrome integration suite passes in GitHub Actions and address any browser timing/platform failures.
- [ ] Manually verify record/replay against a representative real website, including navigation, forms, and dynamic content.


### Phase 13 CI correction

The Chrome smoke test selects `a[title="Next page"]` when asserting the `Continue` link, matching the test's intent without rejecting other valid links returned by the default extractor. Re-run `FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser` in CI to verify.

## Phase 14: workflow data-flow correctness

- Added explicit subworkflow output mapping: map parent variable names to named child variables, with a clear runtime error if a requested child output is missing.
- Preserved the existing `outputVariable` behavior for workflows that want the complete child-variable object; explicit `outputs` mappings can be used alongside it.
- Validate output mapping shape, identifier names, and reserved property names before execution; the node inspector edits the mapping as JSON.
- Added regression tests for mapped values flowing into downstream nodes and invalid output mappings.
- Verification gate: run unit tests, strict typecheck, lint, build, and browser integration in CI. Dependencies are not installed in this workspace, so this phase is not claimed as test-verified.

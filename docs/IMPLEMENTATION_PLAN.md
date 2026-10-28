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
- [ ] Phase 4 scraping: repeated item detection, extraction schema editor, pagination and preview.
- [ ] Phase 5 variables/library: complete scopes, typed expressions, reusable workflow calls, dependency/version tracking.
- [ ] Phase 6 data/batch: Workflow-level CSV export, nested loops, bounded concurrency, cancellation during active operations and resume checkpoints.
- [ ] Phase 7 reliability: breakpoints, recovery, durable run history, performance profiling and cleanup tests.
- [ ] Phase 8 release: security, accessibility, integration/E2E tests and Windows installer validation.

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

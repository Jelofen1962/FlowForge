# FlowForge

FlowForge is a Windows-focused desktop application for visual browser automation, scraping and batch data processing. This is an actively incomplete foundation. It contains working graph, browser, data and persistence slices, but it is not yet the complete product described in the master requirements.

## Requirements

- Node.js 22+
- npm
- Google Chrome installed for Selenium browser automation
- Windows for final installer validation; most pure utility tests can run on Linux

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run package:win
```

## Implemented in this foundation

- Electron desktop shell with context isolation, renderer Node integration disabled, sandboxed preload, a restrictive CSP, sender-validated IPC and bounded file inputs/outputs.
- React/TypeScript node canvas based on React Flow: add supported action nodes, connect nodes, edit configuration, delete nodes, zoom/pan/minimap, and validate/save/load a versioned workflow graph.
- Shared action registry and graph execution engine with step results, log output, cancellation between actions and visible unsupported-action failures.
- Selenium-managed Chrome start/stop and HTTP(S) navigation. Browser actions include click, type, wait, read attribute, extract text, extract links and save output files.
- Recorder element picker in a separate managed Chrome window with a red 40%-opacity overlay, Alt+click interception, CSS/XPath/ID candidates, selector match counts, locator testing, and conversion of a selected element into an editable Click node. Press Escape to cancel selection.
- JSON Field Detector for nested object paths, arrays, types and observed presence; JSON parsing errors are surfaced.
- JSON, CSV and TXT file loading for field inspection; CSV quoting/round-trip helpers, text line parsing and JSON/CSV/TXT field-report export.
- Sequential batch utility with bounded retries, per-item status and row-level errors.
- Dark/light theme, reduced-motion-aware modal transitions, and a CI workflow that checks quality and attempts a Windows installer build.

## Explicitly not complete

- Conditional routing, real `forEach`/nested-loop execution, retry/try-catch graph nodes, reusable subworkflows and dependency/version tracking.
- Full workflow/run/item/environment variable scopes and typed expression interpolation.
- Full recorder action capture for typing/select changes, pause/resume/replay, iframe support and accessible role/name locators.
- Embedded live-browser preview, guided scraping schemas, repeated-item detection, pagination, workflow-level CSV export, OCR and image downloading.
- Durable run history, checkpoint/resume, scheduling, undo/redo, grouping, copy/paste and multi-project management.
- Independent human reviews, end-to-end browser/Electron testing and Windows install/uninstall smoke tests.

The action library disables unsupported control-flow nodes rather than presenting them as working. Imported workflows that contain unsupported action types fail visibly during execution.

## Verification status

Dependency installation could not complete in this execution environment: the online install timed out, and offline installation reported that the npm registry package metadata was not cached. Therefore Vitest, strict project type-checking, lint, Vite production build, Electron launch and Windows packaging have **not** been verified here.

Checks that did run successfully:

- TypeScript syntax transpilation: 14 `.ts`/`.tsx` source/test files.
- Pure utility smoke checks: nested JSON/object/array field detection, safe nested expression resolution, prototype-path rejection, batch row failure/retry accounting, quoted CSV round-trip and TXT line parsing.
- `package.json` parses as valid JSON.

See `docs/IMPLEMENTATION_PLAN.md` and `docs/STATUS.md` for acceptance criteria, review notes and remaining work.

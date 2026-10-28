# FlowForge

FlowForge is a Windows-focused desktop application for visual browser automation, scraping and batch data processing. This is an actively incomplete foundation. It contains working graph, browser, data and persistence slices, but it is not yet the complete product described in the master requirements.

## Requirements

- Node.js 22+
- npm
- Google Chrome installed for Selenium browser automation
- Windows for final installer validation; most pure utility tests can run on Linux

### Structured scraping (Phase 4 initial increment)

Add an **Extract repeated items** node to scrape card/list/table rows. Configure `itemSelector` as the repeated container CSS selector and `fields` as a JSON object mapping output field names to selectors, for example:

```json
{ "title": "h2", "link": "a[href]", "price": ".price" }
```

Optional `nextSelector` clicks a pagination control; `maxPages` is bounded to 100. Extraction is capped at 500 containers per page and 10,000 total rows, and duplicate rows are skipped. Set `outputVariable` to make the resulting array available to downstream workflow nodes.

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

- Retry/try-catch graph nodes, library dependency/version tracking, and full workflow variable scopes. Conditional routing, bounded loops, and reusable subworkflow calls are implemented but still require complete integration verification.
- Full workflow/run/item/environment variable scopes, typed expression interpolation, secret masking, and environment injection.
- Full recorder action capture for typing/select changes, pause/resume/replay, iframe support and accessible role/name locators.
- Embedded live-browser preview, guided scraping schemas, repeated-item detection, pagination, workflow-level CSV export, OCR and image downloading.
- Checkpoint/resume, scheduling, multi-project management, and full accessibility/E2E coverage. Undo/redo, grouping, copy/paste, and capped durable run-summary history are implemented but need full regression verification.
- Independent human reviews, end-to-end browser/Electron testing and Windows install/uninstall smoke tests.

The action library disables unsupported control-flow nodes rather than presenting them as working. Imported workflows that contain unsupported action types fail visibly during execution.

## Verification status

Dependency installation could not complete in this execution environment: the online install timed out, and offline installation reported that the npm registry package metadata was not cached. Therefore Vitest, strict project type-checking, lint, Vite production build, Electron launch and Windows packaging have **not** been verified here.

Checks that did run successfully:

- TypeScript syntax transpilation: 14 `.ts`/`.tsx` source/test files.
- Pure utility smoke checks: nested JSON/object/array field detection, safe nested expression resolution, prototype-path rejection, batch row failure/retry accounting, quoted CSV round-trip and TXT line parsing.
- `package.json` parses as valid JSON.

See `docs/IMPLEMENTATION_PLAN.md` and `docs/STATUS.md` for acceptance criteria, review notes and remaining work.

## GitHub Actions release configuration

- CI deliberately does not enable `setup-node`'s npm cache because a `package-lock.json` is not committed. A lockfile is required before dependency installation can be made fully reproducible with `npm ci`.
- The Windows packaging job receives `GH_TOKEN` from the repository Actions secret named `GH_TOKEN`. Never put the token value in this repository or workflow file.
- The Windows packaging job runs on manual dispatch, `main` pushes, and `v*` tags, not on pull requests. It uploads `release/*Setup.exe` as the `FlowForge-Windows-Installer` Actions artifact.
- Add `GH_TOKEN` under **Repository Settings → Secrets and variables → Actions**. The token needs permission to publish releases to this repository. For a fine-grained token, grant repository **Contents: Read and write**.
- Phase 12 attempted lockfile generation, but the npm registry was unreachable from the current environment. Do not hand-author a lockfile; generate it with `npm install --package-lock-only` in a network-enabled environment, review and commit it, then switch CI to `npm ci` and enable `cache: npm`.


## Phase 2 graph editing

The graph editor supports true/false condition ports, bounded `forEach` loops with nested inline action lists (`items`, `maxItems`, `actions`), item/index expressions, undo/redo, copy/paste of selected nodes and their internal edges, logical grouping labels, and per-node run result styling. Use Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) to redo, and Ctrl/Cmd+C/V to copy/paste. Select multiple nodes with Ctrl/Cmd-click to group them. Workflow validation checks node/edge IDs, graph cycles, start-node rules, variables, and conditional/loop output handles.

The full npm verification gate remains pending when dependencies cannot be installed: run `npm install`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` before packaging.


### Recorder (Phase 3 initial increment)

In the desktop app, launch Managed Chrome in the Recorder or Web Scraping view and choose **Record next**. The next click or text-input change is captured as an editable workflow node; press Escape to cancel. This initial recorder captures one action per request and does not yet record navigation or select-option changes.


### Variables and workflow library

Use the **Variables** panel to add, edit, type, and remove workflow variables. Reference them in node settings with `{{variables.name}}`. The **Library** panel can save the current workflow locally and reopen saved copies. Library entries are stored in this renderer's local storage; they are not yet callable as nested workflow actions or shared across devices.


### Workflow CSV export

Use the **Export CSV** action with `rows` set to an array of objects (for example `{{variables.items}}`) and a `.csv` filename. The action uses the built-in CSV encoder, rejects unsafe filenames, and caps output at 50 MB. Nested loops share a 10,000-iteration ceiling per workflow run.


### Run history

The desktop app stores up to 50 recent run summaries in its local user-data directory. Summaries include workflow name, timestamp, duration, status, step count, and an optional error. Variable values and execution logs are not saved in this history.


### Reusable workflows and scraping preview

Save a workflow in the local library, add a **Run workflow** node, and select the saved workflow. Configure input mappings as a JSON object; the child workflow's variables are returned by the action and can be captured in the configured output variable. Nested workflow calls are limited to ten levels. For scraping, launch managed Chrome and use **Preview current page** in an Extract repeated items node to inspect up to 500 matching rows before running the full workflow.


### Phase 9 recorder and extraction additions

The managed-browser recorder can now convert HTTP(S) link clicks into navigation nodes and native select changes into `selectOption` nodes. The `extractImages` action collects resolved image URLs, alt/title text, dimensions, loading mode, and completion state. The element picker includes XPath candidates based on visible text and accessible labels. Workflow preflight validates browser selectors, scraping field maps, pagination limits, and loop bounds before execution.

- Phase 10 reliability pass: loop budgets are scoped to a workflow run, and cancellation is checked between inline loop actions so remaining actions do not run after a cancellation request. Regression coverage added; full dependency-backed suite remains to be confirmed in CI.

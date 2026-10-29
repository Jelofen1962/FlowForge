# FlowForge

FlowForge is a Windows-focused desktop application for visual browser automation, scraping and batch data processing. FlowForge is under active development. The core graph, browser automation, scraping, data, reusable-workflow, and run-history paths are implemented in increments; remaining product gaps and release gates are tracked in `docs/IMPLEMENTATION_PLAN.md`.


## Documentation

- [Full User Guide](docs/USER_GUIDE.md): node-by-node reference, variables, recorder, scraping, data processing, worked examples, and troubleshooting.
- [Release Acceptance Checklist](docs/RELEASE_ACCEPTANCE.md): required test, browser, data-safety, and Windows packaging gates.
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md): roadmap and remaining work.
- [Phase 3 Browser Notes](docs/PHASE3_BROWSER.md): recorder, semantic locator candidates, iframe targeting, and browser acceptance gates.
- [Phase 7 Completion Pass](docs/PHASE7_COMPLETION.md): implemented closures, remaining product gaps, and release gates.
- [Status](docs/STATUS.md): phase notes and verification caveats.

The user guide documents the current repository behavior and explicitly labels unfinished features. Documentation is not a substitute for passing CI or Windows installer validation.

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
- Shared action registry and graph execution engine with step results, log output, cancellation between actions, node breakpoints/step-resume hooks, and visible unsupported-action failures.
- Selenium-managed Chrome start/stop and HTTP(S) navigation. Browser actions include click, type, wait, read attribute, extract text, extract links and save output files.
- Recorder element picker in a separate managed Chrome window with a red 40%-opacity overlay, Alt+click interception, CSS/XPath/ID candidates, selector match counts, locator testing, and conversion of a selected element into an editable Click node. Press Escape to cancel selection.
- JSON Field Detector for nested object paths, arrays, types and observed presence; JSON parsing errors are surfaced.
- JSON, CSV and TXT file loading for field inspection; CSV quoting/round-trip helpers, text line parsing and JSON/CSV/TXT field-report export.
- Batch utility with bounded concurrency, retries, ordered per-item results, and successful-item checkpoints; the desktop UI also persists batch jobs and supports resume/cancel across app restarts.
- Dark/light theme, reduced-motion-aware modal transitions, and a CI workflow that checks quality and attempts a Windows installer build.

## Explicitly not complete

- Retry/try-catch graph nodes, library dependency/version tracking, and full workflow variable scopes. Conditional routing, bounded loops, and reusable subworkflow calls are implemented but still require complete integration verification.
- `run`-scope defaults initialize each workflow execution; `item`-scope defaults are initialized per loop item. Environment-scoped values are injected in the main process from named environment keys. Secret-typed defaults are encrypted with Electron `safeStorage` and workflow files retain credential references, not the plaintext values. Platform-backed encryption availability and migration behavior still need release testing.
- Recorder still captures one action per request; pause/resume/replay and iframe support are not complete. Locator candidates include CSS/XPath/ID and accessible-name XPath, but broad page compatibility needs more validation.
- OCR and image downloading are not implemented; scraping preview, repeated-item extraction, pagination, and workflow-level CSV export have initial implementations that still need broader integration coverage.
- Scheduling, multi-project management, and full accessibility/E2E coverage. Persistent batch checkpoint/resume is implemented, but Electron restart/cancellation integration still needs release testing. Undo/redo, grouping, copy/paste, and capped durable run-summary history are implemented but need full regression verification.
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

- Phase 12's GitHub Actions workflow is reported green by the project owner. CI currently uses `npm install` because a `package-lock.json` is not committed; a reviewed lockfile and `npm ci` are recommended follow-up improvements for reproducible dependency resolution.
- Windows packaging uses `electron-builder --publish never`; publishing is handled separately by the release job so packaging does not need a personal access token.
- The Windows packaging job runs on manual dispatch, `main` pushes, and `v*` tags, not on pull requests. It uploads `release/*Setup.exe` as the `FlowForge-Windows-Installer` Actions artifact.
- The release job uses GitHub Actions’ built-in `${{ github.token }}` as `GH_TOKEN` and declares `contents: write`. In **Settings → Actions → General → Workflow permissions**, enable read/write permissions if required by repository policy. No personal `GH_TOKEN` secret should be necessary for this workflow.
- This workspace cannot independently run dependency-backed checks because registry access times out. The owner reports that GitHub Actions passed. Do not hand-author a lockfile; generate it with `npm install --package-lock-only` in a network-enabled environment, review and commit it, then switch CI to `npm ci` and enable `cache: npm` as a separate hardening change.


## Phase 2 graph editing

The graph editor supports true/false condition ports, bounded `forEach` loops with nested inline action lists (`items`, `maxItems`, `actions`), item/index expressions, undo/redo, copy/paste of selected nodes and their internal edges, logical grouping labels, and per-node run result styling. Use Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) to redo, and Ctrl/Cmd+C/V to copy/paste. Select multiple nodes with Ctrl/Cmd-click to group them. Workflow validation checks node/edge IDs, graph cycles, start-node rules, variables, and conditional/loop output handles.

The project owner reports the GitHub Actions quality workflow passed, including the configured checks. This workspace could not independently rerun those dependency-backed checks because registry access timed out; see `docs/STATUS.md` for the verification distinction.


### Recorder and scraping validation (Phase 13)

The Alt+click picker now offers stable test-attribute and `name` CSS candidates alongside ID, CSS path, XPath path, accessible-label, title, and visible-text candidates. Each candidate reports its match count so you can prefer unique locators. The quick-tools panel can insert the implemented image-extraction node. The opt-in Chrome integration suite now covers picker selection, click/type/select recording, and repeated-item pagination across a local two-page fixture.

Run the expanded browser suite with `FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser` after installing project dependencies and Chrome.

### Recorder (Phase 3 initial increment)

In the desktop app, launch Managed Chrome in the Recorder or Web Scraping view and choose **Record next**. A click, text-input change, HTTP(S) link navigation, or native select change can be captured as an editable workflow node; press Escape to cancel. Recording is still one action per request, and pause/resume/replay and iframe support remain incomplete.


### Variables and workflow library

Use the **Variables** panel to add, edit, type, and remove workflow variables. Reference them in node settings with `{{variables.name}}`. The **Library** panel stores workflows locally. A **Run workflow** node can call a saved workflow with mapped inputs; child variables are returned as the action result. Library entries are local to the app profile and are not shared across devices.


### Workflow CSV export

Use the **Export CSV** action with `rows` set to an array of objects (for example `{{variables.items}}`) and a `.csv` filename. The action uses the built-in CSV encoder, rejects unsafe filenames, and caps output at 50 MB. Nested loops share a 10,000-iteration ceiling per workflow run.


### Run history

The desktop app stores up to 50 recent run summaries in its local user-data directory. Summaries include workflow name, timestamp, duration, status, step count, and an optional error. Variable values and execution logs are not saved in this history.


### Reusable workflows and scraping preview

Save a workflow in the local library, add a **Run workflow** node, and select the saved workflow. Configure `inputs` as a JSON object. Use `outputs` to map parent variable names to child variable names, for example `{{\"productTitle\":\"title\"}}`; the selected values are available to downstream nodes. For backward compatibility, `outputVariable` can capture the complete child-variable object. Nested workflow calls are limited to ten levels. For scraping, launch managed Chrome and use **Preview current page** in an Extract repeated items node to inspect up to 500 matching rows before running the full workflow.


### Phase 9 recorder and extraction additions

The managed-browser recorder can now convert HTTP(S) link clicks into navigation nodes and native select changes into `selectOption` nodes. The `extractImages` action collects resolved image URLs, alt/title text, dimensions, loading mode, and completion state. The element picker includes XPath candidates based on visible text and accessible labels. Workflow preflight validates browser selectors, scraping field maps, pagination limits, and loop bounds before execution.

- Phase 10 reliability pass: loop budgets are scoped to a workflow run, and cancellation is checked between inline loop actions so remaining actions do not run after a cancellation request. Regression coverage added; full dependency-backed suite remains to be confirmed in CI.

## Releases

The remake release version is **1.1.5** (package version `1.1.5`). The last release before the remake was `v0.3.29`.

To publish a release, push a version tag matching `v*`. For the current version, after committing the version and release-note changes, run:

```bash
git tag v1.1.5
git push origin v1.1.5
```

GitHub Actions first runs quality checks, then builds the Windows NSIS installer. Only if both jobs succeed does it create/update the GitHub Release and attach `FlowForge-1.1.5-Setup.exe`. Re-running the tagged workflow replaces an existing installer asset with the same name. The repository's **Actions** settings must allow workflows to create releases with `GITHUB_TOKEN` (`Settings → Actions → General → Workflow permissions → Read and write permissions`) if organization policy requires that setting.

See [`docs/RELEASE_NOTES_v1.1.5.md`](docs/RELEASE_NOTES_v1.1.5.md) and [`docs/RELEASE_ACCEPTANCE.md`](docs/RELEASE_ACCEPTANCE.md).

### Browser and editor usability

FlowForge detects common installed Chrome, Edge, Firefox, Brave, Vivaldi, Opera, and Chromium locations and lets you choose a managed browser in Recorder/Web Scraping mode. Use **Ctrl+K** to open the shortcut guide. Variable expressions can be inserted from the variable dropdown in node settings. Large JSON/CSV/TXT field detection runs in a background worker so the editor remains responsive. Packaged builds unpack Selenium Manager binaries to avoid trying to execute them from inside `app.asar`.

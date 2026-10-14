# FlowForge Desktop

A Windows-first, local desktop GUI for building sequential browser automations. Built with Electron, React, TypeScript, and Selenium WebDriver. The browser is a real Chrome or Edge process, not an iframe.

## Requirements
- Windows 10/11
- Node.js 20+
- Google Chrome and/or Microsoft Edge installed
- A working Selenium-compatible driver setup. Recent Selenium Manager versions can discover/download drivers automatically when the machine can access the driver endpoints.

## Run in development
```powershell
npm install
npm run dev
```

## Build UI
```powershell
npm run build
npm start
```
For a Windows NSIS installer, run `npm run build:win`. See [`docs/RELEASING.md`](docs/RELEASING.md) for the release checklist and tag workflow.

## Current starter functionality
- Step list with add, delete, reorder, disable, and per-step error policy
- Selenium actions: navigate, click, type, keyboard key, fixed wait, wait-visible, wait-clickable, assert text, select option, screenshot, back, forward, refresh
- XPath, CSS, ID, name, link text, class name, and tag name locator strategies
- Chrome / Edge choice and persistent user-data-directory setting
- Image optimization toggle and close-browser-after-run setting
- Local profile settings saved to Electron userData
- Workflow JSON import/export
- Live engine log stream

## Important implementation notes
This is a working starter scaffold, not a finished all-features product. Read `docs/ROADMAP.md` for the gaps that must be completed before production use. The selector panel currently demonstrates the intended 40% red overlay but is not connected to the browser yet. `disableCss` is currently UI-only and needs CDP network interception. Profile JSON stores configuration, not cookie contents. The `key` step currently sends one Selenium key; implement modifier-chord parsing for combinations such as `CTRL+A`.

## Architecture
- `electron/main.cjs`: desktop window, IPC, process lifecycle, profile configuration persistence
- `electron/preload.cjs`: narrow, context-isolated IPC API
- `src/ui`: React interface
- `engine/runner.cjs`: independent Selenium execution process
- `docs/ROADMAP.md`: planned production capabilities

## Safety
Use only on websites and accounts you are authorized to automate. Persistent browser profiles can contain authentication tokens and sensitive cookies. Keep profile directories private and never commit them to source control.

## Phase 2: Workflow editor

The editor now supports:

- Add, reorder, duplicate, disable, and delete workflow steps.
- Name the workflow and organize steps into editable groups.
- Store named workflow variables in the workflow document. Variable substitution is intentionally not claimed as implemented; it belongs to the engine phase.
- Import and export versioned `.flowforge.json` documents. Imports are validated before they replace the current draft.
- Automatic local draft saving with a short debounce.
- Validation for supported action types, locator requirements, URL schemes, timeouts, duplicate IDs, group references, and variable names.
- Visible validation feedback and prevention of running an invalid or empty workflow.

The editor keeps workflow documents local in the application. Variables are currently plain text in the saved workflow; do not place credentials in them until secret storage and redaction are implemented.

**Verification status:** the workflow schema module passed standalone TypeScript checking and direct validation smoke tests in this environment. Full React/Vite tests and Windows packaging were not verified here because dependency installation timed out. GitHub Actions remains the intended full build/test environment.


## Phase 3: Selenium Core Engine

The engine runs in a separate Node process and emits newline-delimited JSON events. Supported actions include navigation, click, typing, key sequences (for example `CTRL+A`), explicit visibility/clickability waits, fixed waits, text assertions, native select-by-value, screenshots, and browser history controls.

### Workflow variables

Create variables in the workflow and reference them as `${variableName}` in URLs, locator values, typed text, key sequences, and assertion text. Undefined variables fail the step with an actionable error rather than silently becoming an empty string.

### Engine behavior

- Timeouts are bounded to 120 seconds; fixed waits are bounded to 5 minutes.
- Locator-based actions wait for an element to be located and visible; click/select additionally wait for the element to be enabled.
- Screenshot paths are reduced to a filename and written to the configured screenshot directory (or the process working directory).
- `disableCss` blocks CSS requests through Chromium DevTools when supported. This is experimental and may break pages.
- `onError: "continue"` allows the next step to run; other values stop the workflow.
- Browser driver resolution depends on Selenium Manager and an installed Chrome or Edge browser.

Run `npm test` to run unit tests. These tests cover engine validation and helper functions without opening a real browser. Browser integration still needs a Windows GitHub Actions run against an installed browser before release.


## Phase 4: Visual Browser Recorder

The Selenium-controlled browser receives `engine/recorder-bridge.js` when recorder mode is started. Hovering an element highlights it with a red 40%-opacity overlay; clicking selects one target and emits a `FLOWFORGE_RECORDER_V1` message with CSS and XPath locators. The bridge cleans up its overlay after selection.

The engine control channel supports `recorder:start`, `recorder:stop`, and `navigate` commands. Renderer code should validate incoming selection messages with `parseRecorderMessage` from `src/core/recorder.ts` before converting the target to a workflow locator. This phase establishes the real-browser bridge and selector contract; it does not yet claim complete record-all-actions capture or automatic UI insertion.


## Phase 5: Control Flow and Debugging foundations

Workflow steps may now include a `condition` object. Example:

```json
{
  "source": "variable",
  "key": "accountStatus",
  "operator": "equals",
  "expected": "active"
}
```

Supported sources are `variable`, `lastText`, `url`, and `stepStatus`. Operators include `equals`, `notEquals`, `contains`, `notContains`, `matches`, `greaterThan`, `lessThan`, `truthy`, and `falsy`. Conditions that evaluate false skip the step and emit a structured `skipped` event. Unknown variables/step IDs and malformed regular expressions fail explicitly.

The control-flow module also exposes bounded `runCountedLoop` and `withRetry` helpers plus execution records. These are foundational APIs: loops are not yet represented as nested blocks in the editor, and retries are not yet automatically applied around all Selenium actions.


### Browser session snapshots

Open **Profiles** and start a browser session (the recorder keeps a session open), then export or import a versioned JSON snapshot for the current site origin. Snapshots include cookies and that origin's local/session storage, not passwords, cache, or other origins. Expired cookies are skipped and rejected cookies are counted in the engine output.

**Security note:** snapshots are plain JSON and may contain active login credentials. Keep them out of source control and store them securely. Encryption and Windows Credential Manager integration are not included yet.


## Phase 7: Reliability, Recovery & Run History

Steps can be configured for 1–10 total attempts with a delay between retries. The runner emits structured retry events and retains the selected `stop` or `continue` error policy. The **Run history** panel stores the latest 50 local run summaries, including status, elapsed time, and succeeded/failed/skipped step counts.

Retry repeats the complete action. Use it only for actions that are safe to repeat, since clicks and form submissions can have side effects. Run history is local renderer storage, not an encrypted or tamper-proof audit log. Pause/resume, rerun-failed-step, and full browser integration validation remain future work.


## Phase 8: Optimization Engine

The **Optimizations** controls can disable images, stylesheets, web fonts, and common audio/video files. Chromium DevTools URL blocking is configured before the first navigation when supported. The page-load strategy can be `normal` (default), `eager` (return after DOM readiness), or `none` (do not wait for a page-load event). Add explicit wait steps when using faster strategies.

The runner emits per-step elapsed time and a final performance summary with total run duration, latest navigation timing, resource count, and reported transfer bytes. These metrics are diagnostic estimates, not a complete network trace; cache and cross-origin policies can make transfer-size values incomplete. Full browser and Windows CI validation remains required.


## Phase 9: Production Readiness & Windows Packaging

- Electron windows deny new windows and navigation away from the trusted application page; renderer permissions are denied by default.
- Privileged IPC calls are restricted to the trusted top-level application frame.
- Packaged renderer responses receive a Content Security Policy; external font assets are limited to Google Fonts.
- NSIS packaging uses ASAR, maximum compression, explicit packaged files, and versioned architecture-specific installer names.
- CI runs release-config checks, TypeScript, unit tests, builds a Windows installer, and uploads the installer artifact. Tagged releases also generate SHA-256 checksums and publish installer files to GitHub Releases.
- `SECURITY.md` and `docs/RELEASING.md` describe sensitive session data, release steps, and the unsigned-installer limitation.

**Verification status:** Node syntax checks and `npm run verify:release` pass in this environment. Full Vitest, TypeScript, Vite production build, Windows packaging, and live app smoke tests are not verified because dependencies could not be installed here. No GitHub workflow has been run by this package generator. The repository does not yet include `package-lock.json`, so CI currently uses `npm install`; deterministic dependency resolution and npm caching remain follow-up work. The installer is not code-signed.

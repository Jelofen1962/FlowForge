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
- Browser actions: navigate, click, type, key sequences, hover, right-click, double-click, drag-and-drop, scroll-to, page scroll, waits, select, upload file, wait for download, browser history, tabs, frames, and alert handling
- Data actions: extract element text/attributes/input values/tables, save text, capture element images, and take page screenshots
- Assertions: text, URL, page title, element existence/count, and exact attribute values
- Control flow: visual if/else branches, repeat-N blocks, list loops, bounded while loops, break, continue, retries, and reusable nested workflows. Nested branch/loop actions can be added and configured in place without hand-editing JSON.
- Per-workflow output archives: each run can package screenshots, extracted text/data, CSV tables, saved text, image captures, and downloaded files into a ZIP; the Outputs panel previews supported files and can open, reveal, or delete archives
- Native file picker for upload actions, plus XPath, CSS, ID, name, link text, class name, and tag name locator strategies
- Chrome / Edge choice and persistent user-data-directory setting
- Image optimization toggle and close-browser-after-run setting
- Local profile settings saved to Electron userData
- Multi-workflow local library with create, edit, duplicate, delete, and automatic persistence
- JSON import/export packages that include referenced sub-workflows and remap workflow IDs on import
- A `Run another workflow` action that executes reusable sub-workflows in the same browser session, with cycle detection and a maximum nesting depth of 10
- Searchable workflow step list, theme-consistent panels, subtle hover/focus icon motion, and live engine log stream

## Important implementation notes
This is a local-first desktop automation application and still needs a complete Windows integration test before production distribution. Read `docs/ROADMAP.md` for remaining gaps. Workflow library data is stored in Electron/Chromium local storage on the current device. JSON packages include referenced sub-workflows; review exported files before sharing because workflow values may contain personal or sensitive data. Nested workflows reuse the active browser session and inherit parent variables, with child variables overriding same-named parent variables. Cycles are rejected and nesting is limited to 10 levels. Browser-side behavior must still be verified against real Chrome/Edge versions.

## Architecture
- `electron/main.cjs`: desktop window, IPC, process lifecycle, profile configuration persistence
- `electron/preload.cjs`: narrow, context-isolated IPC API
- `src/ui`: React interface
- `engine/runner.cjs`: independent Selenium execution process and artifact collector
- `engine/zip.cjs`: dependency-free ZIP archive writer for per-run outputs
- `docs/ROADMAP.md`: planned production capabilities

## Safety
Use only on websites and accounts you are authorized to automate. Persistent browser profiles can contain authentication tokens and sensitive cookies. Keep profile directories private and never commit them to source control.

## Phase 2: Workflow editor

The editor now supports:

- Add, reorder, duplicate, disable, and delete workflow steps.
- Name the workflow and organize steps into editable groups.
- Store named workflow variables in each workflow and substitute `${variableName}` in supported runtime fields.
- Import and export versioned `.flowforge.json` workflow packages. Imports are validated and added as separate entries in the local workflow library.
- Automatic local draft saving with a short debounce.
- Validation for supported action types, locator requirements, URL schemes, timeouts, duplicate IDs, group references, and variable names.
- Visible validation feedback and prevention of running an invalid or empty workflow.

The editor keeps workflow documents local in the application. Variables are currently plain text in the saved workflow; do not place credentials in them until secret storage and redaction are implemented.

**Verification status:** runner syntax and direct workflow-call smoke tests passed in this environment. The full React/Vite test suite and Windows packaging could not be verified because dependency installation timed out. GitHub Actions remains the intended full build/test environment.


## Phase 3: Selenium Core Engine

The engine runs in a separate Node process and emits newline-delimited JSON events. Supported actions include navigation, click, typing, key sequences (for example `CTRL+A`), explicit visibility/clickability waits, fixed waits, text assertions, native select-by-value, screenshots, and browser history controls.

### Workflow variables

Create variables in the workflow and reference them as `${variableName}` in URLs, locator values, typed text, key sequences, and assertion text. Undefined variables fail the step with an actionable error rather than silently becoming an empty string.

### Engine behavior

- Timeouts are bounded to 120 seconds; fixed waits are bounded to 5 minutes.
- Locator-based actions wait for an element to be located and visible; click/select additionally wait for the element to be enabled.
- Screenshots and other artifacts are written to the current run's output directory and included in its per-workflow ZIP archive.
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

The control-flow module exposes bounded loop and retry helpers. The editor now supports `ifElse`, `repeat`, `loopList`, and `while` actions with nested step arrays edited as JSON rather than a visual block canvas. Retry settings are applied around top-level and nested Selenium actions; retries should be used cautiously for side-effecting actions.


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


## Phase 10: templates and command palette

- Press `Ctrl+K` on Windows (or `Cmd+K` on macOS) to open the searchable command palette. Use `Enter` to run the first filtered command and `Escape` to close it.
- Open **Templates** to load a website smoke-check, form-entry, or search-page starter. Replace example URLs, locators, and values before running against a target site.
- Keyboard focus indicators are visible for interactive controls. A full focus trap, arrow-key navigation, screen-reader certification, and end-to-end Windows verification remain future validation tasks.

## Release status

The source package includes the ten planned delivery phases as a set of first-pass features, not a claim that every capability is production-complete. Run `npm install`, `npm run verify:release`, `npm run typecheck`, and `npm test` in a dependency-installed environment, then build and launch the Windows installer on a clean Windows machine. Do not distribute session snapshots: they can contain active authentication cookies and are currently plain JSON.

## Automatic Windows releases

Push to `main` or `master` to trigger the Automatic Windows Release workflow. After release checks, tests, and the Windows installer build pass, it automatically publishes a versioned GitHub Release with generated notes and SHA-256 checksums. The patch version increments from the latest stable version. Configure repository Actions permissions to allow workflows to create releases (`contents: write`). See [docs/RELEASING.md](docs/RELEASING.md) for details.


### Manual browser-driver detection (Windows)

FlowForge checks for a local ChromeDriver at `C:\WebDriver\chromedriver\chromedriver.exe` before asking Selenium Manager to resolve a driver. For Microsoft Edge, it checks `C:\WebDriver\msedgedriver\msedgedriver.exe`. You can override these paths with `FLOWFORGE_CHROMEDRIVER_PATH` or `FLOWFORGE_EDGEDRIVER_PATH`. The driver should match the installed browser version. If no local driver is found, FlowForge falls back to Selenium Manager.


## UI refresh (October 2026)

The refreshed interface uses Google Poppins typography, larger controls and spacing, layered monochrome surfaces with indigo/cyan accents, animated Lucide SVG interactions, and responsive panel layouts for narrower windows. Use the sun/moon control in the top toolbar to switch between dark and light themes; the preference is saved locally in the renderer. Motion is reduced automatically when the operating system requests reduced motion. The Google Font is loaded remotely, so the system font fallback is used if the machine is offline.

## User-input steps and robust waits

The **Ask user for inputs** action opens a FlowForge dialog while a workflow is running. Add up to 30 titled fields, optionally mark a field required or secret, and map each answer to a webpage element using a CSS, XPath, ID, name, class, or tag locator. On Continue, FlowForge fills each mapped element and resumes the workflow. Secret input values are not written to the run log. Workflow exports still contain the field definitions and target locators, but not values entered into the runtime dialog.

**Wait until visible** and **Wait until clickable** re-query the locator on each polling attempt. This handles modern pages that replace elements during rendering and avoids waiting against a stale element reference. The configured step timeout is used for the entire wait, with a descriptive timeout error.


## Multi-workflow library and reusable sub-workflows

Open **Workflows** in the left navigation to create, reopen, duplicate, export, import, or delete workflows. Edits are saved locally. Add the **Run another workflow** action to call a saved workflow from another workflow. It reuses the current Selenium browser session instead of launching another browser. The runner checks references, rejects cycles, limits nesting to 10 levels, inherits parent variables, and allows a child workflow's own variables to override inherited values. Exporting produces a `.flowforge.json` package containing the selected workflow and its transitive sub-workflow dependencies; importing remaps IDs to avoid collisions with workflows already in the library.

**Sharing note:** workflow JSON is not encrypted. Inspect it for passwords, personal data, or other secrets before sharing. A single legacy workflow JSON file cannot resolve `Run another workflow` references on its own; import the complete FlowForge package.


## Advanced actions and output archives

See [`docs/ADVANCED-ACTIONS-AND-OUTPUTS.md`](docs/ADVANCED-ACTIONS-AND-OUTPUTS.md) for the expanded action catalog, control-flow block format, output archive behavior, size limits, and remaining integration boundaries. Open **Outputs** in the left rail to browse the current workflow's run ZIPs, preview text/image artifacts, open an archive in the system ZIP viewer, reveal it in Explorer, or delete it with its preview files. Output data is stored locally under Electron user data at `outputs/<workflow-id>/`.

Nested `ifElse`, `repeat`, `loopList`, and `while` bodies are currently edited as JSON step arrays in the editor, not with a visual block canvas. `saveImage` stores an element screenshot as PNG. Download detection expects the browser's configured download directory and supports a filename-substring filter. Review output archives before sharing because they can contain personal data.


### Conditional action outcomes (v0.3.11)

If/else and while blocks support `Previous action result` and `Did the URL change?` conditions. Choose an earlier step in the workflow, then branch on `Succeeded`, `Failed`, or `Skipped`. To route a failed action to an Else branch, set that action's error handling to `Continue`; otherwise the default Stop policy ends the workflow immediately. The UI uses a consistent black/white/magenta theme and reduced-motion-aware icon hover animations.


### Bulk selectors and variables (v0.3.12)

- **Set variable** assigns a literal or a string containing `${name}` substitutions. Example: `${firstName} ${lastName}`.
- **Extract all matching elements** queries every element matching a CSS, XPath, id, name, class, tag, or link-text locator and saves text, attributes, or input values as a JSON array variable and `.json` artifact (maximum 5,000 matches).
- **Operate on all matching elements** can click, type into, or extract text/attributes/input values from all matches (maximum 1,000 matches). Extraction results are saved as a JSON array variable. Test broad selectors carefully before bulk click/type.
- The topbar recorder now lets you choose the action to create (click, hover, wait-visible, extract text, or assert exists). It prefers a generated CSS selector and includes element identity/text in the step name and log.

## Interface and localization (v0.3.13)

- The UI uses a consistent sky-blue, black/white design system across the workflow editor, library, templates, browser tools, profiles, outputs, settings, history, and logs.
- English and Persian can be toggled from the top bar. Language preference is saved locally; Persian sets the app language and RTL layout and uses Vazirmatn with local fallbacks.
- The former `lucide-react` dependency has been removed. FlowForge now uses a local Lucide-inspired animated SVG icon set with subtle hover/focus motion and reduced-motion support.
- UI localization covers primary navigation, workflow editing, common action settings, outputs, templates, browser profiles, settings, history, diagnostics, and input prompts. Some user-authored workflow names, logs, imported content, and specialized technical strings intentionally remain as entered.

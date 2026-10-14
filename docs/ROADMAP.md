# FlowForge product plan

## Product shape
A local-first Windows desktop automation studio. The engine owns browser lifecycle, selectors, waits, execution, logs, retries, profile storage, and optimization. The GUI is a workflow editor and inspector, not the automation runtime.

## P0: Make the starter reliable
- Fix the action schema so every step type has validated, typed parameters.
- Parse Selenium `Key` chords (`CTRL+A`, `CTRL+SHIFT+P`) into WebDriver actions.
- Implement actual `disableCss` via Chrome DevTools Protocol request interception; add independent toggles for images, fonts, media, analytics, and third-party requests.
- Add explicit wait conditions: present, visible, invisible, clickable, selected, text present, URL contains, title contains, staleness, and custom JavaScript condition with a safety switch.
- Add retry count, retry interval, step timeout, workflow timeout, cancellation token, and on-error policies.
- Persist workflow JSON with schema versioning and migrations; add validation and useful errors.
- Add secure packaging and signed Windows installer.

## P1: Real visual selector
- Implement a Chrome/Edge extension compatible with Manifest V3 and native-messaging host, or use a controlled DevTools session with a selector script injected into the page.
- On hover, render a fixed overlay with `background: rgba(255, 0, 0, .4)`, high z-index, outline, and a small tooltip. Keep overlay pointer-events disabled.
- On click, prevent the target click, derive XPath and CSS candidates, include tag/id/classes/accessible name and a short DOM path, then return locator candidates to the app.
- Provide locator preview, test locator, highlight matches, disambiguation when multiple nodes match, iframe and shadow-root handling, and a selector fallback list.
- Never use fragile absolute XPath unless user explicitly chooses it.

## P2: Selenium feature coverage
- Add hover, double-click, right-click, drag/drop, scroll, upload file, download wait, select dropdown, checkbox/radio, alert/dialog handling, iframe switching, window/tab switching, browser storage, cookies, execute JavaScript, screenshots, element screenshots, and browser logs.
- Wait DSL should cover Selenium's `until` conditions and custom composable `allOf` / `anyOf` conditions.
- Add variables, environment values, secret fields, string templates, extraction, assertions, branching, loops, subflows, reusable components, and data-driven runs.
- Add breakpoints, step-through, pause/resume, rerun failed step, inspect element attributes/text, and run history.

## P3: Profiles and session portability
- Profiles for Chrome and Edge with per-profile user-data directories.
- Cookie import/export using WebDriver cookie APIs, domain validation, expiry and sameSite preservation where supported.
- Local/session storage snapshots per origin using JavaScript, with origin allowlists and size limits.
- Encrypt exported session bundles with Windows DPAPI; redact secrets from logs; provide profile lock to prevent concurrent use.
- Clear session, clone profile, and show storage inventory.
- Do not copy or open a currently running everyday browser profile. Use a dedicated automation profile.

## P4: Quality and UX
- Dark monochrome UI, keyboard navigation, command palette, Lucide icons, subtle transitions.
- Undo/redo, autosave, search steps, groups, notes, copy/paste, multi-select, and reusable templates.
- Workflow validation, dry-run, selector tester, performance timing, screenshot diffs, accessible labels.
- Structured event log and exportable diagnostics bundle.
- Tests: unit tests for workflow schema, runner integration tests on a local fixture site, Windows smoke tests, browser matrix CI.

## Core step schema (proposed)
```json
{
  "id": "uuid",
  "name": "Wait for submit",
  "type": "wait",
  "condition": { "kind": "elementClickable", "locator": { "strategy": "css", "value": "button[type=submit]" } },
  "timeoutMs": 10000,
  "pollMs": 200,
  "retry": { "count": 0, "delayMs": 500 },
  "onError": "stop",
  "disabled": false
}
```

## Engine contract
- UI sends a versioned workflow document and a profile reference.
- Engine validates the entire workflow before starting.
- Engine emits structured events: `runStarted`, `stepStarted`, `stepSucceeded`, `stepFailed`, `log`, `screenshot`, `runFinished`.
- Engine serializes access to each browser profile, owns cancellation and browser cleanup, and redacts credentials from all logs.
- GUI never directly manipulates Selenium state. All browser interactions flow through the engine.


## Delivery phases (10 phases)

**Current delivery status: Phase 10 of 10 implemented as a first-pass feature set.** The command palette, starter templates, keyboard focus states, and documentation cleanup are included. This does not mean every roadmap capability is production-complete: full dependency-backed tests, live Chrome/Edge integration, and a verified Windows release still require CI verification.

1. **Foundation & desktop shell**: Electron hardening, React UI, Poppins typography, monochrome design, Windows packaging, settings.
2. **Workflow editor**: typed step schema, add/reorder/duplicate/delete, groups, variables, JSON import/export, local autosave, validation. **Implemented in current package; CI verification pending.**
3. **Selenium core**: navigation, click/type/keys, selectors, waits, assertions, tabs, frames, alerts, screenshots, uploads/downloads.
4. **Visual recorder**: 40% red hover overlay, click-to-select, XPath/CSS candidates, selector preview/test/highlight, iframe and shadow DOM.
5. **Control flow & debugging**: if/else, loops, retry, error policies, pause/resume, breakpoints, step-through, rerun failed steps.
6. **Profiles & sessions**: Chrome/Edge profile directories, cookies, localStorage/sessionStorage, encrypted export/import, secret redaction.
7. **Reliability & testing**: bounded action retries, step error policies, persisted run history, structured retry/failure events. Full integration tests, local fixture website, browser matrix tests, and diagnostics export remain.
8. **Optimization engine**: disable CSS/images/fonts/media, block selected network requests, timing metrics, timeout/polling controls.
9. **GitHub delivery**: CI checks, build artifacts, versioned Windows NSIS installer, tag-triggered GitHub Releases, release notes.
10. **Polish & extensibility**: reusable workflow library, command palette, keyboard accessibility, templates, documentation, signed installer.

## CI and exports
- `.github/workflows/ci.yml` runs release configuration checks, typecheck, unit tests, and a Windows NSIS installer build on pushes and pull requests.
- `.github/workflows/release.yml` builds a Windows NSIS installer, generates SHA-256 checksums, and uploads it as a GitHub Actions artifact. Pushing a `v*` tag also creates a GitHub Release and attaches the installer and checksum file.
- The project has not been pushed to a GitHub repository by this generator. Create a repository, push these files, then create a version tag to enable automated release exports.


## Phase 3: Selenium Core Engine

**Implemented in this package; run CI before marking release-ready.**

- Validated engine payloads and bounded timeouts.
- Real Chrome/Edge WebDriver sessions, with persistent user-data directory support.
- Explicit Selenium waits for element location, visibility, and enabled state.
- Navigation, click, typing, key sequences, native select-by-value, text assertions, waits, screenshots, and history controls.
- Workflow variable substitution using `${variableName}`.
- Structured newline-delimited JSON events for step status, warnings, screenshots, completion, and failures.
- CSS blocking uses Chromium DevTools request blocking and reports a warning when unavailable.
- Stop requests are handled gracefully by the runner; Electron IPC preserves the child process lifecycle and frames partial stdout chunks.

**Known limits:** Browser driver availability still depends on an installed compatible Chrome/Edge and Selenium Manager's ability to resolve a driver. Browser-specific DevTools support varies. Stop behavior depends on Node/Electron process signal behavior on the host OS. Cookie/storage snapshot export, visual recording, retries, and debugger controls are later phases.

### Phase 3 acceptance checklist

- [x] Validate payload and URL inputs before starting a browser.
- [x] Bound explicit timeouts and fixed waits.
- [x] Wait for location, visibility, and enabled state as appropriate.
- [x] Support declared variable interpolation in workflow values.
- [x] Emit structured per-step status events.
- [x] Unit tests for pure engine helpers.
- [ ] Confirm Chrome and Edge integration on `windows-latest`.
- [ ] Confirm graceful stop behavior with a live browser on Windows.
- [ ] Confirm installer build and launch from the packaged application.


## Phase 4: Visual Browser Recorder

**Implemented as a first-pass real-browser bridge; end-to-end browser validation remains required.**

- Injected recorder bridge into the Selenium-controlled browser tab (not an iframe).
- Hover target overlay uses `rgba(255,0,0,.4)` and a high z-index.
- Click selection reports tag, id, name, visible text, attributes, XPath, and CSS selector.
- One-shot selection removes overlays and event listeners after a target is selected.
- Renderer-side message parser validates channel and selected-target fields.
- Electron preload exposes recorder start/stop/navigation commands over IPC.
- Unit tests cover recorder message validation and XPath/CSS locator mapping.

**Known limits:** This phase provides the engine bridge and selector model, but a full visual browser control panel and automatic appending of selected elements to the React workflow UI require a live renderer integration. Navigation initiated outside FlowForge may need reinjection; browser extension-grade recording across all page transitions is not claimed.


## Phase 5: Control Flow, Debugging & Execution Reliability

- Added a bounded condition evaluator for variables, last assertion text, current URL, and prior step status.
- Added condition operators for equality, containment, regular expressions, numeric comparisons, and truthiness.
- Added validated bounded counted-loop and retry helper APIs.
- Added execution-history record types with timestamps and duration.
- Engine skips a step when its configured condition evaluates false and emits a structured skip event.
- Added unit tests for condition evaluation, loop/retry bounds, retries, and execution timing.

**Not yet complete:** The counted-loop and retry helpers are unit-testable building blocks, but retry is not yet wired around every Selenium action and loops are not yet represented as nested workflow blocks. Pause/resume and single-step controls remain future work. Full CI verification is required.


## Phase 6 of 10: Profiles, Sessions & State Management
- [x] Save profile metadata separately from session snapshots.
- [x] Export cookies and same-origin local/session storage to a versioned JSON snapshot.
- [x] Validate imported snapshots, limit size, and reject malformed origins/storage/cookies.
- [x] Restore on the snapshot origin; skip expired cookies and report rejected cookies.
- [ ] Encrypt snapshots at rest or provide OS-backed secret storage.
- [ ] Integration-test import/export against real Chrome and Edge on Windows.

Session snapshots are intentionally plain JSON in this phase and can contain authentication credentials. They are not encrypted; handle them as secrets. Snapshots cover one HTTP(S) origin only.


## Phase 7 of 10: Reliability, Recovery & Execution History

- [x] Retry individual Selenium actions with 1–10 total attempts and bounded delay.
- [x] Emit structured `step-retry` events with attempt number and last error message.
- [x] Validate retry configuration in workflow and engine payload validation.
- [x] Expose retry count and delay in the step editor.
- [x] Persist the most recent 50 run summaries locally, including outcome, duration, and success/failure/skip counts.
- [x] Support `stop` and `continue` step error policies with structured failure events.
- [ ] Run the complete Vitest and TypeScript checks in a dependency-installed environment.
- [ ] Validate transient failure recovery with live Chrome/Edge on Windows.

**Known limits:** Run history is stored in renderer local storage and is not an encrypted audit log. Retry replays the whole action, so actions with side effects (such as submitting a form or placing an order) should only be retried when safe to repeat. Pause/resume, rerun-failed-step, and full diagnostics export are not included in this phase.


## Phase 8 of 10: Optimization Engine

- [x] Add validated resource controls for images, CSS, web fonts, and common audio/video files.
- [x] Apply Chromium DevTools URL blocking before the initial navigation when supported.
- [x] Add WebDriver page-load strategies: normal, eager, and none (normal remains the default).
- [x] Emit per-step duration and run/page performance metrics, including navigation timing, resource count, and reported transfer bytes.
- [x] Add unit coverage for optimization normalization and blocked-resource patterns.
- [ ] Verify resource blocking and page-load strategy against real Chrome and Edge on Windows.
- [ ] Run full Vitest, TypeScript, production build, and installer jobs in dependency-installed CI.

**Known limits:** Resource blocking uses Chromium DevTools URL patterns and may not be available with every driver. Transfer byte counts can be incomplete due to caching and cross-origin timing restrictions. `eager` and especially `none` can return before a page is fully ready, so workflows may need explicit wait steps.


## Phase 9: Production Readiness & Windows Packaging

The package includes trusted-frame IPC validation, navigation and popup restrictions, a production Content Security Policy, ASAR packaging, a release configuration checker, Windows CI packaging, tag-based release publishing, SHA-256 checksum generation, and release/security documentation. These safeguards have passed static checks locally, but CI and live Windows execution have not yet been run from this environment. The installer remains unsigned and a committed npm lockfile is still outstanding.


## Phase 10: Final Polish & Extensibility

- [x] Add a searchable command palette, opened with `Ctrl+K` or `Cmd+K`, with actions for run/stop, new workflow, import/export, navigation, and adding common steps.
- [x] Add a reusable template library with website smoke-check, form-entry, and search-page starter workflows. Templates use example URLs and selectors and must be adapted before use.
- [x] Add visible keyboard focus styles, dialog semantics, accessible labels for the command palette, and `Escape` dismissal.
- [x] Update release and feature documentation to distinguish implemented first-pass functionality from unverified integration.
- [ ] Verify command palette interactions and template workflows with the full Vitest suite in CI.
- [ ] Perform keyboard-only and screen-reader checks on Windows.

### Capability status and known gaps

The command palette is a searchable action list; it does not yet implement arrow-key selection or a full focus trap. Template examples are generic scaffolds, not production-tested site-specific workflows. The Browser tab still includes a selector demo and explanatory text; the complete recorder UI experience requires further end-to-end validation. Phase 5 nested loops, pause/resume, breakpoints, and rerun-failed-step are not complete. Phase 6 session JSON is not encrypted. Phase 7 run history is local renderer storage, not an audit log. The installer is unsigned, and live Windows CI results must be checked in GitHub Actions before distribution.

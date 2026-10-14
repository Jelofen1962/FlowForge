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

**Current delivery status: Phase 2 of 10 completed in this package.** Phase 1 remains the existing desktop shell; Phase 2 adds the workflow editor model and editing safeguards. The app has not yet been built or exercised on Windows in this environment, so the implementation is code-complete but awaiting CI verification.

1. **Foundation & desktop shell**: Electron hardening, React UI, Poppins typography, monochrome design, Windows packaging, settings.
2. **Workflow editor**: typed step schema, add/reorder/duplicate/delete, groups, variables, JSON import/export, local autosave, validation. **Implemented in current package; CI verification pending.**
3. **Selenium core**: navigation, click/type/keys, selectors, waits, assertions, tabs, frames, alerts, screenshots, uploads/downloads.
4. **Visual recorder**: 40% red hover overlay, click-to-select, XPath/CSS candidates, selector preview/test/highlight, iframe and shadow DOM.
5. **Control flow & debugging**: if/else, loops, retry, error policies, pause/resume, breakpoints, step-through, rerun failed steps.
6. **Profiles & sessions**: Chrome/Edge profile directories, cookies, localStorage/sessionStorage, encrypted export/import, secret redaction.
7. **Optimization engine**: disable CSS/images/fonts/media, block selected network requests, timing metrics, timeout/polling controls.
8. **Reliability & testing**: unit tests, integration tests, local fixture website, browser matrix tests, structured logs, diagnostics.
9. **GitHub delivery**: CI checks, build artifacts, versioned Windows NSIS installer, tag-triggered GitHub Releases, release notes.
10. **Polish & extensibility**: reusable workflow library, command palette, keyboard accessibility, templates, documentation, signed installer.

## CI and exports
- `.github/workflows/ci.yml` runs typecheck, unit tests, and the UI build on pushes and pull requests.
- `.github/workflows/release.yml` builds a Windows NSIS installer and uploads it as a GitHub Actions artifact. Pushing a `v*` tag also creates a GitHub Release and attaches the installer.
- The project has not been pushed to a GitHub repository by this generator. Create a repository, push these files, then create a version tag to enable automated release exports.

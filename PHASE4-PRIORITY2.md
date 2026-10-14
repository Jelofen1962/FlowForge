# Phase 4 Priority 2: Recorder, element picker, and YAML caching

## Implemented

- **Record** starts a visible browser session and captures page clicks plus non-password form values into workflow steps.
- **Pick** highlights elements with a red overlay. Clicking an element returns a CSS selector and fills the selected step's selector field.
- Selector generation prefers unique `data-testid`, `data-test`, `data-qa`, ID, `name`, and `aria-label` selectors, then falls back to a CSS path with positional qualifiers where needed.
- Captured steps are added to the current editor workflow and use the existing step model so they can be reviewed and edited before replay.
- Recorder event handlers and the exposed Playwright binding are removed when recording/picking stops to avoid duplicate listeners across sessions.
- Password inputs are deliberately excluded from captured form values.
- YAML parsing and serialization use bounded, 64-entry LRU caches. Cached parsed documents are cloned before being returned so caller mutations cannot corrupt cache entries. Cache clear/stat helpers support tests and diagnostics.
- Integration tests cover recording clicks/form values and picking a selector against a local test page.

## Usage

1. Open CobWeb as a Tauri desktop app and set the starting URL.
2. Select **Record** to interact with the visible browser. Each click and supported form-value change is appended to the workflow.
3. Select **Stop recording** when finished. Review the generated steps, adjust selectors or values, and save/export the workflow.
4. To configure one existing step, select it and press **Pick** in the selector field. Click the desired element in the controlled browser. Its generated CSS selector is placed into the selected step.

The browser recorder requires a supported Chromium-family browser and the local Node/Playwright runner. The iframe preview is not used for picking because it may be cross-origin or block embedding.

## Validation commands

```bash
npm run check:runner
npm run test:runner
npm run test
npm run test:e2e
npm run build
```

Set `COBWEB_TEST_BROWSER` to a local Chrome, Edge, or Chromium executable to run the real-browser runner integration tests. Those tests are skipped when no executable is configured.

## Current limitations

- The recorder captures clicks and form values, not every possible browser input event. Drag/drop, scroll, keyboard shortcuts, file uploads, downloads, and dialog interactions are not recorded yet.
- Password values are not recorded by design.
- Generated CSS selectors are best-effort and should be reviewed on dynamic sites.
- The picker and recorder operate in the first page in the attached Chromium context; multi-tab targeting is not implemented.
- YAML caching accelerates repeated parsing/serialization of identical input. It does not cache mutable live editor state or skip validation for a different document.

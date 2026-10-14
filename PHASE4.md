# Phase 4: Browser execution engine

CobWeb now has a first executable browser-runner path for the desktop app. The React UI invokes the Tauri `launch_browser` command, then calls `execute_workflow`, which starts the Node companion runner. The runner attaches to the launched Chromium-family browser over the local Chrome DevTools Protocol endpoint and executes steps sequentially.

## Supported step types

- Navigation: `navigate`, `back`, `forward`, `reload`
- Waiting: `wait`, `waitUntil`, `delay`
- Pointer: `click`, `doubleClick`, `rightClick`, `hover`
- Form/keyboard: `type`, `fill`, `clear`, `press`, `select`, `check`
- Assertions/capture: `visibleAssert`, `textAssert`, `urlAssert`, `extract`, `screenshot`

For element steps, enter a CSS selector in the step detail. For value-bearing steps, place the value after `·`, for example `css: input[name="email"] · hello@example.com`. For `textAssert`, place the expected text after `·` and provide the target selector before it. `delay` uses a millisecond value. Screenshot paths are relative to the app process working directory unless an absolute path is supplied.

## Requirements

- A supported local browser (Edge, Chrome, or Chromium)
- Node.js available as `node` on PATH
- Project dependencies installed with `npm install` (the runner uses the Playwright package)
- Run workflows inside the Tauri desktop app. The regular browser build intentionally does not pretend to execute desktop automation.

## Checks

```bash
npm run check:runner
npm run test
npm run test:e2e
npm run build
```

## Current boundaries

The execution engine stops at the first failed step and returns structured logs. Browser sessions are attached through CDP. Pause/resume at breakpoints, hard cancellation of an active run, multi-tab targeting, conditional/loop blocks, file upload/download, cookie/storage actions, and arbitrary JavaScript evaluation are not implemented by this runner yet. These step types fail with an explicit unsupported-step error rather than silently pretending to run. The Node companion approach is suitable for the current development phase; a packaged production release should bundle/manage the runner runtime and Playwright dependency rather than assume a user's Node installation.

## Priority 1 execution controls

The runner now uses a line-oriented control protocol over its standard input/output. The desktop app starts the runner asynchronously and receives step logs and state events through Tauri's `workflow-event` event channel. `Pause` takes effect at the next safe step boundary (the current browser action is allowed to finish); a configured breakpoint pauses before that step when Live debugging is enabled. `Resume` continues execution and `Stop` cancels the run, returns a cancelled result, and closes the runner's browser connection. F6 requests pause, F8 resumes, and Shift+F8 stops.

Supported controls and reliability behavior:

- Emits state, step-start, log, and finished events.
- Reports disabled steps as skipped and stops on the first failed step.
- Applies bounded per-step timeouts and returns structured cancellation/error results.
- Exposes Pause/Resume and Stop controls in the builder while a run is active.
- Adds real-browser integration tests using a local HTML fixture. Set `COBWEB_TEST_BROWSER` to the full path of a Chromium, Chrome, or Edge executable and run `npm run test:runner` to execute them. Without that variable, the browser-backed integration test is skipped rather than pretending it ran.

Control limitations: Pause is cooperative and takes effect after the in-flight browser operation finishes. Cancellation races the in-flight operation and then tears down the runner connection; the underlying browser process remains managed by the desktop launcher. The current execution model remains single-run and sequential.

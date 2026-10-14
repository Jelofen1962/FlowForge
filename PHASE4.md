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

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
For a distributable installer, add `electron-builder` or `electron-forge` and configure Windows NSIS packaging.

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

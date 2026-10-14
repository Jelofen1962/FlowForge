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

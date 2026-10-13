# Cobweb

Cobweb is a local-first desktop browser automation studio built with React, TypeScript, Vite, Rust, and Tauri 2. Its visual language is shadcn-inspired: mostly black and white, quiet borders, gray metadata, and Lucide icons.

## New in this build

### Browser profiles
- Create named profiles and choose the active profile.
- Configure independent profile-level preferences for session state, HTTP cache, cookies, local storage, and IndexedDB, plus global defaults for new profiles.
- Choose headless mode per profile.
- The Rust browser launcher uses a separate Chromium `--user-data-dir` per selected profile and a separate HTTP cache directory.
- Profile preference definitions are saved in local app storage.

**Important persistence boundary:** Chromium's user-data directory persists cookies, local storage, IndexedDB, and other browser state together. The UI stores the individual persistence preferences, but those per-store toggles are not yet enforced against Chromium. True independent clearing/preservation requires the next CDP layer (`Network.clearBrowserCookies`, `Network.clearBrowserCache`, and origin-scoped `Storage`/`DOMStorage` operations), plus session restore logic. Do not interpret the individual toggles as already controlling the underlying browser data.

### Visual logic blocks
- A simple Scratch-inspired canvas in the existing Cobweb visual style.
- `Wait until…`, `Wait X ms`, `If / else`, `Repeat`, `Group`, click, and type block palette.
- Condition block with true/false lanes, nested action cards, selectable blocks, and a settings inspector.
- `Wait until` configuration includes condition type, selector, timeout, and polling interval controls.

The canvas and editor are implemented; the blocks still need to be serialized into the automation model and executed by the real browser runner. Branching and waits are not yet real browser execution.

### JSON data engine
- Accepts a JSON array, one JSON object, or NDJSON/JSONL records.
- Safe nested path traversal including array indexes (`user.profile.name`, `orders[0].total`).
- Infers field paths and types, presence percentage, unique-value counts, and numeric ranges.
- Query operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `regex`, `exists`, and `in`.
- Field projection, pagination, JSON/NDJSON/CSV export, and batch manifest export.
- Rust Tauri commands `inspect_json_payload` and `query_json_payload` are included for native JSON inspection and filtered/projection queries.

The current UI parses and queries its in-memory dataset. Streaming ingestion, persistent inverted indexes, full-text indexing, regex on the native Rust side, and huge-file memory optimizations remain future work. For very large datasets, the recommended next step is a streaming Rust worker rather than loading all records into the WebView.

## Existing starter features

- Website cards and URL setup.
- Workflow step list, step picker, editor, breakpoint toggles, and live-debug UI.
- Performance page (sample timings until real instrumentation is connected).
- Browser optimization controls and visible/headless controls.
- Keyboard shortcut reference.
- Windows-only GitHub Actions workflow for Tauri builds.

## Known implementation boundaries

This is a working UI/backend foundation, not a finished general-purpose automation runner. The browser launcher can start Chromium-family browsers and assigns a profile directory. The following require CDP integration before they can be considered functional: arbitrary page interaction execution, the red element-picker overlay, reliable pause-before-step and continue semantics, actual per-step timing, network resource interception, individual cookie/storage/cache controls, and execution of logic blocks. The current runner UI still contains demo behavior for some of those interactions.

## Requirements

- Node.js 22+
- Rust stable and Cargo
- Tauri system prerequisites: https://v2.tauri.app/start/prerequisites/
- Chromium, Chrome, or Edge available to the Rust process

## Run locally

```bash
npm install
npm run dev
```

Run as a desktop app:

```bash
npm install
npm run tauri -- dev
```

Build installers:

```bash
npm run tauri -- build
```

## GitHub Actions

`.github/workflows/build.yml` builds on `windows-latest` only for pushes to `main`, pull requests, and manual runs. It uploads the Windows bundles as a workflow artifact. The workflow intentionally does not enable `setup-node` npm caching until a `package-lock.json` is committed, because npm caching requires a dependency lockfile. It currently uses `npm install`; committing a lockfile and switching to `npm ci` is recommended for reproducible builds. Release signing and versioned GitHub Releases can be added after the first verified builds.

## Suggested next milestones

1. Connect Rust to the Chromium DevTools Protocol over loopback WebSocket.
2. Implement a typed workflow schema with nested groups, branch blocks, variables, and data-row bindings.
3. Implement the runner with real wait-until polling, conditions, loops, retries, and step events.
4. Wire profile-level persistence policies to CDP and profile cleanup controls.
5. Move large JSON/NDJSON ingestion and indexing to streaming Rust code, with query plans and indexed equality lookups.
6. Add run history, reproducible batch reports, and verified signed releases.

## Security

- Keep CDP bound to loopback only. Never expose the debugging port to the LAN.
- Treat JavaScript evaluation, downloads, file uploads, cookies, and arbitrary navigation as powerful actions.
- Validate URLs and selectors and clearly display the target origin.
- Do not export cookies, tokens, or credentials with workflow JSON by default.


## Windows portable build

GitHub Actions builds a standalone `Cobweb.exe` and publishes it as the
`Cobweb-Portable-Windows-x64` artifact. Download that artifact and run
`Cobweb.exe` on a supported 64-bit Windows machine. It does not require an
installer, but **WebView2 Runtime is still a Windows runtime dependency**;
most supported Windows 10/11 systems already have it. The optional NSIS
installer is published separately as `Cobweb-Installer-Windows-x64`.

The application UI is scaled to 125% for readability.

## Current production-readiness limits

The app includes a workflow editor, local draft persistence, JSON export,
profile/data/logic screens, and a Rust command that launches a local
Chromium-family browser. The automation runner does **not yet execute the
configured click/type/assertion steps through CDP**; the recorder and browser
preview are placeholders, and performance metrics are sample data. Do not use
these screens as proof of successful unattended automation until those
integrations and automated tests are implemented. Local drafts are WebView
storage, not a synced or backed-up database.


## Automated tests

- `npm test`: Vitest unit tests for workflow validation, draft parsing, filename sanitation, URL validation, JSON/NDJSON parsing, nested field paths, filtering, and dropdown interactions.
- `cargo test --manifest-path src-tauri/Cargo.toml`: Rust unit tests for the native JSON parser, nested-path resolver, and query filtering.
- GitHub Actions runs both test commands before frontend and Tauri builds.


## UI interaction and persistence pass

The workspace, engine, help, account, group, and per-step menus use a shared
accessible dropdown component. Menus close with Escape or an outside click.
The workflow editor includes duplicate/enable/disable/delete step actions,
group-level enable/disable actions, and real website creation with local
persistence. Workflow URL and runtime preferences are persisted with the draft.
The interface includes restrained transitions, hover feedback, focus rings,
and reduced-motion support.

Run `npm test` for frontend unit/component tests. CI also runs native Rust
unit tests before building. The local environment used for this revision did
not complete npm dependency installation, and Rust tooling was not available,
so these suites must be confirmed in GitHub Actions before calling the release
verified.


### npm install 404 workaround

The project pins transitive Rollup to `4.34.8` with npm `overrides` to avoid the unavailable `rollup-4.64.6.tgz` reported by the Windows runner. CI also asks npm to prefer fresh registry metadata. Confirm the install in Actions, then commit the generated `package-lock.json` for fully reproducible dependency installs.

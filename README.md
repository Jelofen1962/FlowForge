# Cobweb Phase 1: Backend foundation

Merge-ready Rust/Tauri v2 backend scaffold for the Cobweb desktop browser automation studio.

## Included
- Windows Edge/Chrome/Chromium discovery with explicit executable-path override.
- Safe URL/profile validation, loopback-only DevTools port allocation, isolated profile directories, process lifecycle tracking.
- CDP HTTP discovery (`/json/version`), correlated WebSocket request/response handling, navigation, JavaScript evaluation, coordinate input, element resolution, waits, and common browser actions.
- JSON/NDJSON parsing, schema summaries, filtering, row binding, execution manifests.
- Workflow step types and sequential execution with step results and stop-on-error behavior.
- Tauri commands for browser lifecycle, CDP actions, data inspection/filtering, workflow execution, and script runner invocation.
- Unit tests for validation, data engine, selectors/URL policy, workflow behavior, and exporters/command argument validation.
- GitHub Actions Windows CI running Rust tests and Tauri build.

## Security notes
- The DevTools endpoint binds only to `127.0.0.1`.
- Only `http` and `https` navigation URLs are accepted.
- Do not expose the DevTools port on a network interface.
- External runner execution uses a configured executable and argument list, never a shell command string.
- This scaffold does not include credentials or remote control services.

## Integrating
Copy `src-tauri/` into the existing project, merge the `tauri.conf.json` settings with your current configuration, and register the command list from `lib.rs`. Keep your existing Tauri capabilities file and add only the permissions required by your app.

## Run tests (on a machine with Rust installed)
```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Build prerequisites for Windows: Rust stable/MSVC toolchain, WebView2, Node.js, and the frontend/Tauri CLI configured in the main project.

## Verification status in this environment
Rust/Cargo are not installed in the execution environment used to prepare this package, so `cargo test` and a Windows binary build could not be run here. Tests are included but must be executed in the Windows CI workflow before Phase 1 is marked verified.

# CobWeb Phase 3 delivery

## Implemented

- YAML workflow import/export, in addition to JSON.
- Strict import validation before state changes: schema version, root shape, HTTP(S) URL, settings types, workflow step shape, duplicate IDs, and length limits.
- YAML parser configured to reject duplicate keys and disallow aliases.
- Unit tests for YAML round-trip, malformed YAML, invalid schema/URL, duplicate IDs, and alias rejection.
- Playwright E2E configuration and smoke tests for workspace navigation, website persistence, and workflow editing.
- `test:e2e` and `test:all` npm scripts; CI installs Chromium and runs E2E tests before build.
- README updated with setup, quality gates, and honest runtime boundaries.

## Acceptance commands

```sh
npm install
npx playwright install chromium
npm run test
npm run test:e2e
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Not represented as complete

The native browser launcher starts Chromium-family browsers and exposes a loopback DevTools port, but the app still lacks the full CDP command dispatcher and event model required to execute click/type/assertion actions. The UI runner's progression is still a preview, not real browser automation. Phase 3's workflow configuration and quality-gate work is in place; full CDP execution remains a distinct implementation milestone and must not be implied by green UI tests alone.

## Validation environment note

Dependency installation was attempted in the build environment but timed out while reaching the package registry. Therefore no local npm test/build result is claimed for this delivery. CI is configured to run the checks in a network-enabled Windows environment.

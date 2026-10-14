# CobWeb frontend YAML scenarios and Playwright tests

## What's included
- `tests/scenarios.yaml`: readable, ID-labelled test plan for QA review.
- `tests/frontend.spec.ts`: executable Playwright tests for the Phase 2 React UI.
- `playwright.config.ts`: browser/test-runner setup.
- `.github/workflows/frontend-tests.yml`: CI workflow.
- `package.test-additions.json`: dependency and npm-script additions to merge into the existing package.json.

## Install
Merge the entries from `package.test-additions.json` into the existing `package.json`, preserving existing scripts/dependencies. Then run:

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

For CI, commit the resulting `package-lock.json`. GitHub Actions runs `npm ci`, so a matching lockfile is required.

## Run the YAML scenarios
The YAML is the human-readable specification; the executable Playwright suite is TypeScript and mirrors its cases. It is not automatically interpreted as test code in this package. If you want YAML to drive execution dynamically, add a YAML scenario loader and a generic step runner as a separate enhancement.

## Important integration note
The frontend scaffold's browser discovery and workflow execution currently depend on Tauri command signatures. In browser preview, the adapter intentionally rejects workflow execution. The browser discovery test expects a successful mocked/preview response as the scaffold currently implements it; if the app is running in Tauri, the backend command names and return shapes must match `src/backend.ts`. Align those names with `src-tauri/src/commands.rs` before treating desktop integration tests as authoritative.

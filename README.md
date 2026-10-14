# CobWeb

CobWeb is a local-first desktop browser automation workspace built with Tauri 2, Rust, React, TypeScript, and Vite.

## Repository layout

```text
.
├── .github/workflows/
│   ├── backend-windows.yml    # Windows Rust/Tauri backend checks
│   └── frontend-tests.yml     # Frontend unit, E2E, YAML validation, and build
├── scripts/
│   └── validate-scenarios.mjs # Validates tests/scenarios.yaml
├── src/                       # React UI and unit tests
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── backend.ts
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   └── test/setup.ts
├── src-tauri/                 # Tauri shell and Rust backend
├── tests/
│   ├── frontend.spec.ts       # Playwright browser E2E tests
│   └── scenarios.yaml         # Scenario catalogue
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vite.config.ts
```

Build output (`dist/`), dependencies (`node_modules/`), Playwright reports, and Rust build output are generated locally and ignored by Git.

## Requirements

- Node.js 20 or newer
- npm
- Rust stable and the platform prerequisites for Tauri 2 to build the desktop application
- Playwright Chromium for browser E2E tests

## Frontend development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run test:scenarios
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

- `npm run test:scenarios` parses `tests/scenarios.yaml` and checks required fields and unique scenario IDs.
- `npm run test` runs Vitest unit tests under `src/` only.
- `npm run test:e2e` runs Playwright tests in `tests/frontend.spec.ts`; its config starts Vite automatically.
- `npm run build` type-checks and creates the frontend assets in `dist/`.

The YAML file is currently a scenario catalogue and validation source. Playwright's executable browser actions are maintained in `tests/frontend.spec.ts`; the validator does not automatically translate YAML steps into browser actions.

## Desktop backend

Before running Tauri commands that load `tauri.conf.json`, build the frontend so `src-tauri/tauri.conf.json` can resolve `../dist`:

```bash
npm install
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

The GitHub Actions backend workflow follows this order on Windows. Frontend CI runs unit tests, validates the scenario catalogue, executes browser E2E tests, and builds the UI.

## CI behavior

GitHub Actions installs dependencies from `package.json`, installs Chromium, validates the YAML catalogue, runs unit and E2E tests, and builds the frontend. No runner-side edits to `package.json` or temporary Vitest configuration are required.

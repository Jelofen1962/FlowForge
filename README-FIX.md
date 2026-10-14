# Fix for frontend test failures

This patch fixes the two causes shown in the CI log:

1. Vitest was discovering `tests/frontend.spec.ts`, which is a Playwright spec. Vitest now only discovers `src/**/*.test.{ts,tsx}`.
2. React Testing Library renders were leaking between tests. The setup file explicitly calls `cleanup()` after each test, preventing duplicate buttons, switches, and textboxes.

## Apply
Copy `vite.config.ts` to the repository root and `src/test/setup.ts` into the matching path, replacing the current files.

Merge `package.test-additions.json` into your existing `package.json` (do not replace the whole package file). From the repository root run:

```bash
npm install --save-dev @playwright/test yaml
npm install
npm run test
npm run test:e2e
npm run build
```

Commit the updated `package.json` and `package-lock.json` so GitHub Actions can install the same dependencies.

## CI commands
Run Vitest and Playwright separately:
- `npm run test` runs React unit tests under `src/`.
- `npm run test:e2e` runs browser tests under `tests/`.

If any individual test still fails after cleanup, inspect its new assertion output. The duplicate-element errors in the supplied log should be resolved by cleanup.

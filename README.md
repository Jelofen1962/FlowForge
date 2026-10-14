# CobWeb GitHub Actions frontend CI

Replace `.github/workflows/frontend-tests.yml` in your repository with the included workflow.

The workflow assumes:
- `package.json` is at the repository root.
- React frontend source is in `./src`.
- Playwright browser tests are in `./tests/frontend.spec.ts`.
- Existing package dependencies include React, Vite, TypeScript, Vitest, and React Testing Library.

It runs these commands on GitHub's runner, not on your computer:
1. `npm install --save-dev @playwright/test yaml`
2. `npm install`
3. `npm run test`
4. `npm run test:e2e`
5. `npm run build`

To prevent the earlier issues without local edits, the workflow temporarily creates a Vitest config and test setup file on the runner. Vitest only discovers `src/**/*.test.tsx` / `.test.ts`, explicitly cleans up React renders, and does not try to import Playwright specs. It also creates the `test` and `test:e2e` npm scripts on the runner.

The `npm pkg set` edits and temporary files exist only in the ephemeral GitHub Actions checkout. The workflow does not commit or push them back to your repository.

Note: the repository's `package.json` must already include `vite`, `typescript`, `vitest`, `@vitejs/plugin-react`, `react`, `react-dom`, `@testing-library/react`, and `@testing-library/jest-dom`. If not, add the missing dependencies in the workflow's install step or your package manifest.

# GitHub Actions lockfile fix

This workflow assumes the repository layout is:

```text
.
├── package.json
├── package-lock.json   # should be committed
├── index.html
├── src/
├── tests/
├── playwright.config.ts
└── .github/workflows/frontend-tests.yml
```

It removes `cache: npm`, which is the immediate cause of setup-node failing when no lockfile exists. Dependency installation temporarily uses `npm install` if the lockfile is absent, and `npm ci` once a lockfile is committed.

Recommended one-time local setup from the repository root:

```bash
npm install
npm install --save-dev @playwright/test yaml
npx playwright install chromium
git add package.json package-lock.json .github/workflows/frontend-tests.yml
git commit -m "Fix frontend GitHub Actions dependency setup"
git push
```

If `package.json` is actually inside `src/` (not merely the source code), this workflow must instead set `working-directory: ./src` on npm commands and point setup-node's `cache-dependency-path` to `src/package-lock.json`. Most Vite apps keep `package.json` at the repository root and source files under `src/`.

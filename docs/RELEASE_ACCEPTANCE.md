# FlowForge Phase 16: Release Candidate and Acceptance

## Goal

Consolidate the product documentation and define the evidence required before calling a build release-ready. This phase does not claim that unavailable CI, browser, or Windows checks passed.

## Release gates

### 1. Source quality

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Review the full CI run and confirm every required job is green.

### 2. Browser integration

- [ ] Install Chrome in the test environment.
- [ ] Run `FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser` locally or the equivalent CI step.
- [ ] Verify navigation, text extraction, link extraction, native select changes, image metadata extraction, repeated-item extraction, pagination, and session cleanup.
- [ ] Re-run the browser suite after any change to `ChromeSession`, selectors, or browser cleanup.

### 3. Workflow engine

- [ ] Confirm malformed workflow input fails before execution.
- [ ] Confirm exactly one start node and valid graph edges are required.
- [ ] Test condition true and false branches.
- [ ] Test loop caps, nested-loop shared budget, and cancellation.
- [ ] Test subworkflow inputs, mapped outputs, missing output failure, failed child propagation, and the 10-level nesting limit.
- [ ] Confirm unsupported actions fail visibly.

### 4. Data and persistence

- [ ] Test JSON field detection for nested objects and arrays.
- [ ] Test CSV quoting, embedded quotes, commas, and newlines.
- [ ] Test TXT line handling and field-report export.
- [ ] Test unsafe filenames, output size limits, invalid JSON/workflow values, and failed writes.
- [ ] Confirm atomic-write paths leave the prior destination intact when the temporary write fails, where supported by the filesystem.
- [ ] Confirm run history remains capped at 50 summaries and does not persist variables or execution logs.

### 5. Desktop and Windows package

- [ ] Launch the packaged application on a clean Windows environment.
- [ ] Confirm browser start/stop, save/load, Library, Variables, run history, cancellation, and output writing.
- [ ] Test installer install, launch, upgrade/replace if supported, and uninstall.
- [ ] Confirm no secrets are embedded in the application bundle or repository.
- [ ] Upload the installer artifact and retain the relevant CI logs.

### 6. Documentation

- [ ] Review `README.md` for accurate setup and project scope.
- [ ] Review `docs/USER_GUIDE.md` against the actual build and remove stale UI descriptions.
- [ ] Confirm each supported node type has a configuration description and example.
- [ ] Confirm limitations are explicit and not marketed as implemented capabilities.
- [ ] Record the tested version, OS, Node/npm versions, Chrome version, and CI run URL in the release notes.

## Recommended commands

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser
npm run package:win
```

The browser integration suite is included in CI with `FLOWFORGE_CHROME_INTEGRATION=1`. The Windows packaging job is configured to run on manual dispatch, `main` pushes, and `v*` tags, after the quality job succeeds.

## Release decision

Do not mark the release as accepted until all applicable gates above have evidence. A successful archive-integrity check or TypeScript syntax transpilation is useful but does not substitute for type-checking, tests, lint, production build, live Chrome tests, or Windows install/uninstall verification.

## Known release risks

- No committed `package-lock.json` exists in this source snapshot. CI uses `npm install`; reproducible installs should be hardened separately by generating and reviewing a real lockfile in a network-enabled environment and then switching to `npm ci`.
- Variable scope labels and the `secret` type exist, but full scope semantics, secret masking, and environment injection are incomplete.
- Recorder capture is one action at a time; pause/resume/replay and iframe support are incomplete.
- Checkpoint/resume, scheduling, OCR, image downloads, cloud library sync, and retry/try-catch nodes are not complete.
- Independent Windows install/uninstall smoke testing remains a release gate.

## Phase 16 deliverables

- `docs/USER_GUIDE.md`: feature-by-feature user documentation with node reference, configuration examples, worked workflows, troubleshooting, and limitations.
- `docs/RELEASE_ACCEPTANCE.md`: explicit release gates and evidence requirements.
- Updated README links to the full guide and acceptance checklist.

**Status:** documentation and acceptance criteria prepared. Runtime release acceptance remains pending CI and Windows verification.

## Selenium Manager packaging fix

The Windows installer copies Selenium Manager to `resources/selenium/selenium-manager.exe` outside `app.asar`, and the packaged main process sets `SE_MANAGER_PATH` to that executable before browser automation can start. This avoids attempting to spawn an executable through an `app.asar` path. Verify this in a packaged Windows install by checking that the file exists under the installed FlowForge `resources` directory and starting Chrome/Edge.

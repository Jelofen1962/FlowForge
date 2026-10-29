# Phase 4: Repeated-item extraction and pagination UX

## Delivered

- Added explicit loading and disabled states to the current-page extraction preview.
- Preview failures are caught and reported without leaving stale rows visible.
- Editing the item selector, field map, pagination selector, or page limit invalidates the previous preview.
- Empty previews now explain that the item/field selectors should be checked.
- Preview labels explicitly say it reads the current page and only displays the first five rows; workflow extraction remains separately bounded and can follow pagination.
- Added managed-Chrome integration coverage for current-page preview and early validation of missing item/field configuration. Existing coverage exercises two-page extraction and duplicate-row suppression through the fixture.

## Limits and behavior

- Preview intentionally does not follow pagination. It is a fast selector check for the current document.
- Workflow extraction supports a maximum of 100 pages, up to 500 repeated items per page, 10,000 total output rows, and 5,000 characters per extracted field value.
- Exact duplicate rows are suppressed across pages. Rows with identical configured field values are therefore considered duplicates, even if the source site treats them as distinct records.
- CSS selectors must match the page structure; the preview does not evaluate JavaScript application state or shadow DOM.

## Acceptance checklist

- [x] Preview has a loading state and prevents duplicate clicks while running.
- [x] Editing extraction settings clears old preview results.
- [x] Preview failures do not leave stale results on screen.
- [x] Empty preview explains the likely selector issue.
- [x] Integration tests cover current-page preview and invalid extraction configuration.
- [x] Existing integration test covers pagination across two fixture pages.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` with installed dependencies.
- [ ] Run `FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser` with Chrome and driver available.
- [ ] Manually verify preview and pagination against a representative dynamic site.

## Verification note

Source syntax checks and archive integrity are not substitutes for the dependency-backed quality gate or live Chrome verification. Those checks remain pending in this workspace.

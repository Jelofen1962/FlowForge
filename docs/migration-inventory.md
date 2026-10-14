# Legacy migration inventory

## Status

This Phase 0 scaffold was generated from the rebuild specification. The legacy CobWeb repository
was not included alongside the plan in this working set, so legacy behavior has not yet been
inspected or verified. Do not interpret an unverified item as implemented.

| Existing feature / area | Legacy status | Python/Qt target | Phase | Verification needed |
|---|---|---|---:|---|
| Workflow YAML format | Not audited | Versioned YAML + typed domain models | 1 | Inspect existing files and map fields |
| YAML parsing/validation | Not audited | Safe parser + validation service | 1 | Invalid syntax/schema fixtures |
| Parsed workflow cache | Prior plan indicates cache is desired; implementation not audited | Fingerprinted derived cache | 1, verify in 6 | Same-size edits, corruption, invalidation |
| Browser runner | Prior project discussion indicates a runner exists in legacy app; source not present here to inspect | Python Playwright runner | 2 | Fixture workflow replay |
| Visual editor | Not audited | PySide6 step list/properties editor | 3 | UI create/edit/save tests |
| YAML editor | Not audited | PySide6 YAML editor | 3 | Validation and sync tests |
| Recorder | Prior project discussion identifies this as a priority; source not audited | Playwright event capture + normalization | 4 | Record/replay fixture |
| Element picker | Prior project discussion identifies runner path failures; source not audited | Isolated picker overlay + locator ranking | 4 | Pick controls, match counts, cleanup |
| Logs/artifacts | Not audited | Structured run events and artifact browser | 5 | Error/screenshot tests |
| Packaging | Not audited | Windows package + browser diagnostics | 7 | Clean-machine install test |

## Next audit inputs

Provide the legacy repository/archive to replace "Not audited" with evidence-backed findings before porting
or discarding behavior.

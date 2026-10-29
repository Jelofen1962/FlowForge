# Phase 5: Variables and reusable workflow library

## Delivered

- Added a scope selector to workflow variables: `workflow` values are initialized once for the run; `item` defaults are copied into a fresh variable context for each `forEach` iteration.
- Item-local mutations no longer leak into the parent workflow or the next loop item. Nested loop actions inherit the current item context.
- Added a regression test covering item variable reset and isolation.
- Kept secret fields masked while editing, and clarified that masking is not encryption. Workflow files and the local library can still contain secret values, so do not store credentials in them.
- Reused the existing local reusable-workflow library and subworkflow snapshot model; no new dependencies or storage layers were added.

## Scope boundaries

- Environment-scoped variables are now resolved in the Electron main process at run start. Set the variable value to the environment key name (for example, `FLOWFORGE_API_TOKEN`); the actual value is never written into the workflow definition by this feature. Missing or invalid environment keys fail the run before actions execute.
- Secure credential storage is still not implemented. Secret-typed workflow defaults are only masked in the editor and remain part of saved workflow JSON; use environment scope for credentials.
- The library remains local to the current app profile. Cross-device synchronization and dependency/version tracking remain out of scope.

## Acceptance checklist

- [x] Variable editor exposes workflow and item scopes.
- [x] Item defaults are initialized for each loop iteration.
- [x] Item-scoped writes are isolated from parent and sibling iterations.
- [x] Regression test added.
- [ ] Run unit tests, strict typecheck, lint, production build, and desktop smoke test in a dependency-enabled environment.

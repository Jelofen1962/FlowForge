# Phase 5: Variables and reusable workflow library

## Delivered

- Added a scope selector to workflow variables: `workflow` values are initialized once for the run; `item` defaults are copied into a fresh variable context for each `forEach` iteration.
- Item-local mutations no longer leak into the parent workflow or the next loop item. Nested loop actions inherit the current item context.
- Added a regression test covering item variable reset and isolation.
- Kept secret fields masked while editing, and clarified that masking is not encryption. Workflow files and the local library can still contain secret values, so do not store credentials in them.
- Reused the existing local reusable-workflow library and subworkflow snapshot model; no new dependencies or storage layers were added.

## Scope boundaries

- Environment-variable injection and secure secret storage are not implemented in this phase. They require an explicit main-process/IPC contract and a credential storage design, not access to arbitrary renderer environment data.
- The library remains local to the current app profile. Cross-device synchronization and dependency/version tracking remain out of scope.

## Acceptance checklist

- [x] Variable editor exposes workflow and item scopes.
- [x] Item defaults are initialized for each loop iteration.
- [x] Item-scoped writes are isolated from parent and sibling iterations.
- [x] Regression test added.
- [ ] Run unit tests, strict typecheck, lint, production build, and desktop smoke test in a dependency-enabled environment.

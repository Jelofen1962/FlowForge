# Phase 7: unfinished-feature closure pass

## Implemented in source

- Environment-scoped variables are resolved in the Electron main process at run start. The saved variable value is the environment key name (for example, `FLOWFORGE_API_TOKEN`), not the secret value.
- Environment key names are validated against a conservative identifier pattern. Missing keys fail the run before any workflow action starts.
- Environment resolution traverses embedded subworkflows, so declared child environment variables are checked and passed through the same runtime-only map.
- Batch processing accepts `resumeResults` supplied by the caller. It reuses only successful results whose index is valid and whose input still matches. Failed/cancelled results and stale inputs are processed again.
- Added regression coverage for environment injection, matching checkpoint reuse, stale-input invalidation, concurrency ordering, and cancellation behavior.
- Updated the user guide and implementation notes to reflect the actual feature boundaries.

## Still incomplete, not marked as shipped

- **Secure credential storage:** `secret` typed workflow defaults are still serialized as ordinary workflow values. Editor masking is not encryption. Use environment-scoped variables for credentials.
- **Persistent batch jobs:** the batch helper can resume from caller-provided checkpoints, but the desktop UI does not yet own a batch job store or offer a resume-job screen.
- **Run scope:** the schema recognizes `run`, but the editor and runtime do not provide distinct run-scoped semantics.
- **Step debugging:** the disabled debugger control is not an implemented breakpoint/step/resume system.
- **Release acceptance:** browser recorder behavior against representative real sites, keyboard/screen-reader audit, full dependency-backed CI, Electron launch, and Windows install/uninstall have not been verified in this workspace.
- **Integration coverage:** tests exist for many features, but they must be executed in CI with dependencies and Chrome available before release claims are made.

## Verification evidence available here

- TypeScript/TSX syntax transpilation passed for 19 source/test files using the globally installed TypeScript compiler.
- Batch utility runtime checks passed for concurrency ceiling/order, checkpoint input matching, and cancellation using a transpiled module.
- ZIP integrity is checked on the final phase archive.
- Vitest, strict typecheck, ESLint, production build, Electron/Chrome integration, and Windows packaging are not claimed as passing.

## Acceptance checklist

- [x] Environment injection is main-process-only and validates declared environment keys.
- [x] Nested reusable workflows receive their declared environment-scoped values.
- [x] Batch resume rejects stale inputs and reprocesses unsuccessful rows.
- [x] Documentation distinguishes implemented behavior from remaining work.
- [ ] Secure credential storage and distinct run-scope semantics.
- [ ] User-facing persistent batch checkpoint/resume flow.
- [x] Basic breakpoints and pause/continue/step debugger implementation.
- [ ] Electron integration testing for debugger edge cases.
- [ ] Dependency-backed CI, real Chrome, accessibility, and Windows release acceptance.

## Phase 8 feature-completion updates

- Secret-typed non-environment variables are now encrypted at rest with Electron `safeStorage` in the user-data credential vault. Saved workflow JSON contains a credential marker, not the secret text. Existing plaintext secret defaults are migrated when opened or saved. If OS-backed encryption is unavailable, saving a new secret fails visibly rather than writing plaintext.
- Run-scoped variables are initialized per execution and can be passed into a subworkflow only through its explicit input mapping. Item-scoped defaults remain isolated per loop item.
- The renderer receives the sanitized workflow returned by save, so saved secret values are replaced in editor state after saving.
- Added node breakpoints plus desktop pause/continue/step controls. Step mode pauses before each subsequent active node; continue runs until the next explicit breakpoint.

## Still not release-complete

- Persistent batch checkpoint recovery is still a helper-level capability, not a complete user-facing batch-job/resume workflow.
- Debugger UI is implemented, but pause/continue/step behavior still needs Electron integration testing, especially cancellation while paused and multiple breakpoint sequences.
- Secure-storage migration, OS-specific `safeStorage` behavior, and subworkflow credential handling require dependency-backed integration tests on supported Windows builds.

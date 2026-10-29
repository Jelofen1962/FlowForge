# Phase 6: bounded batch execution

- Added optional `concurrency` to `runBatch`, capped at 32 workers; the default remains `1` to preserve sequential behavior.
- Results stay in original input order even when workers finish out of order. Per-item retries and progress callbacks remain supported.
- Added optional `resumeResults`: only successful checkpoint rows with an in-range index and matching input are reused; failed/cancelled rows and stale inputs are retried. The caller owns checkpoint persistence and should store checkpoints atomically.
- Queued items are marked cancelled when the supplied abort signal is set. Active workers receive the same signal and must honor it to stop their own in-flight work.
- Added a regression test for the concurrency ceiling and stable result ordering.

## Verification

- Regression tests cover matching-checkpoint reuse and changed-input invalidation.
- Source syntax transpilation and focused runtime checks are the available local checks.
- Vitest, strict typecheck, lint, production build, and desktop/browser checks require project dependencies, which are not installed in this workspace; those checks remain unverified here.

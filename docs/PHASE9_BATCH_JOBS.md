# Phase 9: Persistent batch jobs

The Batch Run dialog executes the current workflow once for each value in a JSON array. The configured item variable is injected as a run-time variable and can be referenced with `{{variables.item}}` (or the selected variable name).

Batch jobs are saved in the application's user-data directory. Each item result is checkpointed atomically. Resume skips successful item indexes and retries failed/cancelled items. A job snapshots its workflow and inputs so resuming does not silently switch to an edited canvas or changed input array. Job records retain status, step counts, errors, item inputs, and workflow definition, but do not persist execution logs or runtime variable values. Secret defaults are converted to credential references before the workflow snapshot is saved.

Items run sequentially because browser automation uses a shared browser session. The app permits only one active workflow or batch at a time. Cancellation is cooperative: the active workflow receives an abort signal, then the checkpoint records cancellation; external websites may already have accepted a side effect before cancellation reaches the automation action, so resumed jobs should be designed to tolerate repeated failed items.

## Acceptance checks

- Start a batch of simple data-only items and confirm progress updates and per-item checkpoints.
- Close/reopen the application, load saved jobs, and resume a job with completed items skipped.
- Fail an item, resume, and confirm only unfinished items rerun.
- Cancel during a long browser action and verify the job is marked cancelled and can resume.
- Confirm workflow snapshots contain no plaintext secret defaults and summaries contain no runtime variable values.
- Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, Chrome integration tests, and Windows packaging in CI. These checks are not verified in this workspace because project dependencies are unavailable.

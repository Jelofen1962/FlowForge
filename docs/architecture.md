# Architecture overview

## Phase 0 boundaries

- `ui/` will contain thin PySide6 widgets and Qt models.
- `application/services/` will orchestrate user-facing operations.
- `domain/` will contain framework-independent workflow/action/run models.
- `engine/` will own Playwright lifecycle and action dispatch.
- `recording/` and `picker/` will turn browser events and selections into domain actions.
- `persistence/` will be the only layer allowed to write workflow YAML.
- `config/` owns defaults and user settings.
- `tests/` is split into unit, integration, UI, and end-to-end coverage.

## Dependency direction

UI -> application services -> domain/repositories.
Engine -> domain models and Playwright.
Persistence -> domain models.
Domain must not import Qt or Playwright. Recording and picker must not write YAML directly.

## Long-running work

Browser operations must run outside the Qt GUI thread using worker objects/signals. Cancellation
must be explicit and browser resources must close in guaranteed cleanup paths.

## Source of truth

Workflow YAML will be authoritative. Parsed workflow caches are derived, versioned, invalidatable,
and never contain browser objects, secrets, or run state.

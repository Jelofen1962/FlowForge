# CobWeb: Python + Qt foundation

Phase 0 starter foundation for rebuilding CobWeb as a desktop browser-workflow automation app.

## Requirements

- Python 3.12+
- Windows is the initial target; the package avoids relying on the current working directory.
- Chromium is installed separately by Playwright when the browser engine phase is introduced.

## Setup (PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
pytest
python -m cobweb.app
```

If PowerShell blocks activation, run `.venv\Scripts\python.exe -m pip ...` directly.

## Current scope

This is intentionally Phase 0 only: package layout, Qt startup, startup diagnostics,
logging, config defaults, tests, and architecture/setup documentation. Workflow YAML,
browser execution, recording, and element picking are not implemented yet.

## Project layout

See `docs/architecture.md` and `docs/migration-inventory.md`.

## Phase 1 status

Implemented typed workflow/action/locator models, schema-v1 validation, safe YAML loading, atomic saving,
import/export helpers, explicit migration guard, and in-memory/optional disk cache. See `docs/workflow-schema.md`
and `docs/phase-1.md`. Phase 1 tests currently pass in the available Python environment.

# CobWeb: Python + Qt foundation

CobWeb is being rebuilt as a desktop browser-workflow automation app using Python, PySide6/Qt,
Playwright, and versioned YAML workflows. YAML will remain the workflow source of truth.

## Requirements

- Python 3.12+
- Windows is the initial target; the code avoids relying on the current working directory.
- Playwright Chromium is installed in CI and will be checked by the application as browser features land.

## Local setup (PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
python -m playwright install chromium
python -m pytest
python -m ruff check src tests --select E4,E7,E9,F
python -m compileall -q src tests
python -m cobweb.app
```

If PowerShell blocks activation, use `.venv\Scripts\python.exe -m pip ...` directly.

## Test categories

Tests are grouped by directory and marker:

- `tests/unit`: isolated model, settings, YAML, persistence, migration, and cache tests.
- `tests/integration`: repository/cache behavior across components.
- `tests/ui`: Qt smoke tests using the offscreen platform plugin.
- `tests/e2e`: local deterministic Playwright browser smoke tests. No live websites or credentials.

Run all tests:

```powershell
python -m pytest
```

Run one category:

```powershell
python -m pytest -m unit
python -m pytest -m integration
python -m pytest -m ui
python -m pytest -m e2e
```

Create local coverage and JUnit reports:

```powershell
python -m pytest --junitxml=test-results/junit.xml --cov=cobweb --cov-report=term-missing --cov-report=xml:coverage.xml --cov-report=html:htmlcov
```

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes to `main`, `master`, and `develop`, pull requests, and manual dispatch. It runs only on Windows, executes the complete test suite, performs critical lint and compile checks, builds the Python wheel/source distribution and a Windows `CobWeb.exe`, validates package metadata, and uploads test reports, coverage reports, and Windows exports as downloadable Actions artifacts.

`.github/workflows/release.yml` runs verification and builds Windows release exports on version tags such as `v0.1.0`, attaching `CobWeb.exe`, the wheel, source distribution, and source snapshot ZIP to a GitHub Release. A manual run uploads exports as an Actions artifact.

### Downloading exports

Open the repository's **Actions** tab, select a successful workflow run, and download its artifacts:

- `test-reports-*`: JUnit XML, coverage XML, and HTML coverage report.
- `cobweb-windows-exports`: `CobWeb.exe`, installable wheel, source distribution, and source snapshot ZIP.

## Current scope

The current milestone contains the Phase 0 shell and Phase 1 workflow models, safe YAML repository,
atomic persistence, schema guard, and parsed-workflow cache. The browser runner, full visual editor,
recorder, and element picker are planned phases and are not represented as complete features yet.

See `docs/architecture.md`, `docs/migration-inventory.md`, `docs/workflow-schema.md`, and `docs/phase-1.md`.

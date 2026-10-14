# Testing and GitHub Actions exports

## Local test suite

The complete suite is run with `python -m pytest`. Tests are grouped by responsibility:

- Unit: models, settings, safe YAML parsing, atomic writes, migrations, and cache behavior.
- Integration: repository load/save/cache behavior across components.
- UI: Qt main-window smoke test with `QT_QPA_PLATFORM=offscreen`.
- E2E: Playwright interaction with a deterministic local HTML page.

Browser tests must not depend on a live third-party website or a real user account.

## CI workflow

`.github/workflows/ci.yml` runs for pushes to `main`, `master`, and `develop`, pull requests, and
manual dispatch. It verifies the suite on Windows only, installs Playwright Chromium, runs
critical lint rules and Python compilation, and builds Python distributions after checks succeed.

The test job exports JUnit XML, coverage XML, and HTML coverage as an Actions artifact. The build
job exports the wheel, source distribution, and a source snapshot ZIP. Artifacts expire after the
configured retention period, so download and archive anything needed long-term.

## Release workflow

`.github/workflows/release.yml` runs verification before producing exports. Push a semantic version
tag such as `v0.1.0` to build the wheel, source distribution, and source snapshot and attach them to a
GitHub Release. A manual run uploads the exports as an Actions artifact rather than creating a release.

## Current limitations

- CI verifies package exports, not a Windows installer or standalone desktop executable. PyInstaller
  packaging and clean-machine validation remain part of the later packaging phase.
- UI and browser tests depend on their respective Qt/browser dependencies being installed. CI installs
  these dependencies; local environments without them may report a skip.
- Coverage is reported but is not yet enforced with a minimum threshold. Set a threshold only after
  the feature surface and baseline coverage stabilize.


## Windows-only exports

Both CI and tagged releases run on `windows-latest`. Successful checks build `CobWeb.exe` with PyInstaller, a Python wheel, a source distribution, and a repository source ZIP. Playwright Chromium is installed in the workflow for browser tests; the executable currently represents the desktop shell and does not bundle Chromium.

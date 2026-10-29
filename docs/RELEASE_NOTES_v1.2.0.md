# FlowForge v1.2.0

## Highlights

- Added a visual workflow editor with node connections, conditional paths, bounded loops, undo/redo, and workflow validation.
- Added browser recording and element selection with CSS, XPath, ID, accessible-label, and test-attribute locator candidates.
- Expanded browser extraction for structured fields, links, text, images, pagination, and repeated items.
- Added workflow variables, environment-variable resolution, protected credential storage, reusable subworkflows, and data-file exports.
- Added execution diagnostics, breakpoints, step debugging, cancellation handling, and persistent batch jobs with resume support.
- Improved save reliability with atomic writes and strengthened validation at IPC and workflow boundaries.
- Fixed Windows Selenium Manager packaging by placing the manager executable in the application resources outside `app.asar` and configuring Selenium to use that path.

## Windows browser startup

The packaged application includes Selenium Manager at `resources/selenium/selenium-manager.exe`. If Chrome still fails to start, verify that this file exists in the installed application and that the machine can reach the network when Selenium needs to obtain a compatible driver. Browser startup must be smoke-tested on the target Windows installation before publishing.

## Verification status

The source archive's syntax, metadata, and archive integrity checks may be performed independently, but they do not replace the release pipeline. Before publishing this version, require the GitHub Actions quality job, typecheck, unit tests, Chrome integration test, lint, production build, and Windows installer packaging to pass. Also install the packaged application on Windows and verify Chrome startup, a short browser workflow, and uninstall.

- Version: `1.2.0`
- Installer filename: `FlowForge-1.2.0-Setup.exe`
- Tested OS / Node.js / npm / Chrome versions: record from the release run
- CI run URL: add the successful GitHub Actions run URL before publishing

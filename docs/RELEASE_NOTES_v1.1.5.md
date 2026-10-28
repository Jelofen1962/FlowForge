# FlowForge v1.1.5

FlowForge v1.1.5 is the first versioned release for the remake line. The last release before the remake was **v0.3.29**.

## Highlights

- Visual workflow editor for composing supported browser and data-processing actions.
- Workflow variables, conditional paths, loops, and reusable workflow calls, subject to the implementation and integration status documented in the user guide.
- Browser automation and recorder-based element selection with locator candidates.
- Web extraction, structured data handling, and supported file export paths.
- Run diagnostics and safer persistence writes.
- Full Markdown user guide and release acceptance checklist in `docs/`.

## Important release status

This release is published automatically only after the GitHub Actions quality checks and Windows packaging job succeed. The workflow runs typechecking, tests, Chrome integration tests, lint, build, and Windows installer packaging before publishing the installer.

The release pipeline passing confirms those automated checks, not every possible website or operating-system scenario. Review `docs/RELEASE_ACCEPTANCE.md` and `docs/STATUS.md` for remaining limitations and any manual acceptance checks.

## Installation

Download `FlowForge-1.1.5-Setup.exe` from the GitHub Release assets and run the installer on Windows.

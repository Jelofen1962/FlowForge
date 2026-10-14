# Development setup

Use Python 3.12 or newer.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
pytest
python -m cobweb.app --diagnostics
python -m cobweb.app
```

The current Phase 0 shell does not launch a browser, so Playwright Chromium installation is not needed
until browser-engine work is introduced. Later phases should add an explicit browser dependency check.

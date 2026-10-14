"""User settings location and conservative settings loading."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from cobweb.config.defaults import DEFAULT_SETTINGS

LOGGER = logging.getLogger(__name__)


def get_user_data_dir() -> Path:
    """Return a stable per-user data directory, independent of cwd."""
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "CobWeb"
    if sys_platform_is_macos():
        return Path.home() / "Library" / "Application Support" / "CobWeb"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "cobweb"


def sys_platform_is_macos() -> bool:
    import sys
    return sys.platform == "darwin"


def load_settings(path: Path | None = None) -> dict[str, Any]:
    """Load JSON settings, falling back to defaults if missing or invalid."""
    settings_path = path or (get_user_data_dir() / "settings.json")
    if not settings_path.exists():
        return dict(DEFAULT_SETTINGS)
    try:
        with settings_path.open("r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        if not isinstance(loaded, dict):
            raise ValueError("Settings root must be a JSON object")
        return {**DEFAULT_SETTINGS, **loaded}
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        LOGGER.warning("Settings could not be loaded; defaults will be used: %s", exc)
        return dict(DEFAULT_SETTINGS)

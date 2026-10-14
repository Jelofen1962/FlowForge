"""Startup checks and dependency wiring for CobWeb."""

from __future__ import annotations

import logging
import platform
import sys
from typing import Any

from cobweb import __version__
from cobweb.config.settings import get_user_data_dir, load_settings
from cobweb.logging_config import configure_logging


def initialize() -> dict[str, Any]:
    """Initialize safe startup infrastructure and return diagnostics."""
    data_dir = get_user_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    log_path = configure_logging(data_dir / "logs" / "cobweb.log")
    settings = load_settings()
    logging.getLogger(__name__).info("CobWeb startup initialized")
    return {
        "app_version": __version__,
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "user_data_dir": str(data_dir.resolve()),
        "log_file": str(log_path.resolve()),
        "settings_loaded": isinstance(settings, dict),
    }

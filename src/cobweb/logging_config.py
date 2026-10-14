"""Application logging configuration."""

from __future__ import annotations

import logging
from pathlib import Path


def configure_logging(log_file: Path) -> Path:
    """Configure console and rotating-safe simple file logging."""
    log_file.parent.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Avoid duplicate handlers when initialize() is called repeatedly in tests.
    if not any(getattr(handler, "_cobweb_handler", False) for handler in root.handlers):
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler._cobweb_handler = True  # type: ignore[attr-defined]
        root.addHandler(file_handler)

        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler._cobweb_handler = True  # type: ignore[attr-defined]
        root.addHandler(console_handler)

    return log_file

"""Default application settings."""

DEFAULT_SETTINGS: dict[str, object] = {
    "browser": "chromium",
    "headless": False,
    "default_timeout_ms": 10_000,
    "navigation_timeout_ms": 30_000,
    "screenshot_on_failure": True,
    "cache_enabled": True,
    "log_level": "INFO",
    "artifact_retention_days": 30,
}

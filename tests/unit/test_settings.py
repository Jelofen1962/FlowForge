from pathlib import Path

from cobweb.config.settings import load_settings


def test_missing_settings_returns_defaults(tmp_path: Path) -> None:
    result = load_settings(tmp_path / "missing.json")
    assert result["browser"] == "chromium"
    assert result["default_timeout_ms"] == 10_000


def test_invalid_settings_falls_back_to_defaults(tmp_path: Path) -> None:
    settings_file = tmp_path / "settings.json"
    settings_file.write_text("{ invalid json", encoding="utf-8")
    result = load_settings(settings_file)
    assert result["headless"] is False


def test_valid_settings_override_defaults(tmp_path: Path) -> None:
    settings_file = tmp_path / "settings.json"
    settings_file.write_text('{"headless": true, "custom_option": 5}', encoding="utf-8")
    result = load_settings(settings_file)
    assert result["headless"] is True
    assert result["custom_option"] == 5
    assert result["browser"] == "chromium"

from pathlib import Path

from cobweb.bootstrap import initialize


def test_initialize_creates_user_data_and_log(monkeypatch, tmp_path: Path) -> None:
    import cobweb.bootstrap as bootstrap

    monkeypatch.setattr(bootstrap, "get_user_data_dir", lambda: tmp_path / "CobWeb")
    diagnostics = initialize()
    assert Path(diagnostics["user_data_dir"]).exists()
    assert Path(diagnostics["log_file"]).parent.exists()
    assert diagnostics["settings_loaded"] is True

from pathlib import Path
from cobweb.persistence.atomic_write import atomic_write_text


def test_atomic_write_creates_parent_and_content(tmp_path: Path):
    target = tmp_path / "new" / "nested" / "file.yaml"
    atomic_write_text(target, "name: test\n")
    assert target.read_text(encoding="utf-8") == "name: test\n"
    assert list(target.parent.glob("*.tmp")) == []

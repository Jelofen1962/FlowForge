from pathlib import Path

import pytest

from cobweb.persistence.cache import DiskWorkflowCache, WorkflowCache
from cobweb.persistence.yaml_repository import WorkflowRepository


def _write_workflow(path: Path, name: str = "Demo") -> None:
    path.write_text(
        f"schema_version: 1\nid: demo\nname: {name}\nsteps: []\n",
        encoding="utf-8",
    )


def test_in_memory_cache_returns_independent_model_copy(tmp_path: Path) -> None:
    path = tmp_path / "workflow.yaml"
    _write_workflow(path)
    repo = WorkflowRepository(cache=WorkflowCache())
    first = repo.load(path)
    first.name = "Mutated in memory"
    assert repo.load(path).name == "Demo"


def test_cache_is_bounded(tmp_path: Path) -> None:
    cache = WorkflowCache(max_entries=1)
    paths = [tmp_path / "one.yaml", tmp_path / "two.yaml"]
    for path in paths:
        _write_workflow(path)
    repo = WorkflowRepository(cache=cache)
    repo.load(paths[0])
    repo.load(paths[1])
    assert len(cache._entries) == 1


def test_disk_cache_invalidates_after_source_changes(tmp_path: Path) -> None:
    source = tmp_path / "workflow.yaml"
    _write_workflow(source, "First")
    disk_cache = DiskWorkflowCache(tmp_path / "cache")
    repo = WorkflowRepository(disk_cache=disk_cache)
    assert repo.load(source).name == "First"
    _write_workflow(source, "Second")
    assert repo.load(source).name == "Second"


def test_disk_cache_disabled_does_not_write(tmp_path: Path) -> None:
    source = tmp_path / "workflow.yaml"
    _write_workflow(source)
    cache_dir = tmp_path / "cache"
    repo = WorkflowRepository(disk_cache=DiskWorkflowCache(cache_dir, enabled=False))
    assert repo.load(source).name == "Demo"
    assert not cache_dir.exists()


def test_cache_does_not_return_data_for_deleted_source(tmp_path: Path) -> None:
    source = tmp_path / "workflow.yaml"
    _write_workflow(source)
    repo = WorkflowRepository(cache=WorkflowCache())
    assert repo.load(source).name == "Demo"
    source.unlink()
    from cobweb.domain.errors import WorkflowLoadError

    with pytest.raises(WorkflowLoadError):
        repo.load(source)

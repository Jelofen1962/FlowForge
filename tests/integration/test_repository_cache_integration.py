from pathlib import Path

import pytest

from cobweb.persistence.cache import DiskWorkflowCache, WorkflowCache
from cobweb.persistence.yaml_repository import WorkflowRepository

pytestmark = pytest.mark.integration


def test_yaml_save_reload_and_disk_cache_round_trip(tmp_path: Path) -> None:
    source = tmp_path / "source.yaml"
    destination = tmp_path / "exports" / "workflow.yaml"
    source.write_text(
        "schema_version: 1\nid: roundtrip\nname: Round Trip\nsteps: []\n",
        encoding="utf-8",
    )
    repository = WorkflowRepository(
        cache=WorkflowCache(), disk_cache=DiskWorkflowCache(tmp_path / "parsed-cache")
    )
    loaded = repository.load(source)
    repository.save(destination, loaded)
    exported = repository.load(destination)
    assert exported.id == "roundtrip"
    assert exported.name == "Round Trip"
    assert destination.exists()


def test_external_edit_cannot_be_shadowed_by_memory_or_disk_cache(tmp_path: Path) -> None:
    source = tmp_path / "workflow.yaml"
    source.write_text(
        "schema_version: 1\nid: live\nname: Before\nsteps: []\n",
        encoding="utf-8",
    )
    repository = WorkflowRepository(
        cache=WorkflowCache(), disk_cache=DiskWorkflowCache(tmp_path / "cache")
    )
    assert repository.load(source).name == "Before"
    source.write_text(
        "schema_version: 1\nid: live\nname: After!\nsteps: []\n",
        encoding="utf-8",
    )
    assert repository.load(source).name == "After!"

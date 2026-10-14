from pathlib import Path
import pytest
from cobweb.domain.errors import WorkflowLoadError, WorkflowValidationError
from cobweb.persistence.yaml_repository import WorkflowRepository
from cobweb.persistence.cache import WorkflowCache, DiskWorkflowCache

FIXTURE = Path(__file__).parents[1] / "fixtures" / "workflows" / "basic.yaml"


def test_load_and_save_round_trip(tmp_path):
    repo = WorkflowRepository()
    workflow = repo.load(FIXTURE)
    target = tmp_path / "nested" / "workflow.yaml"
    repo.save(target, workflow)
    reloaded = repo.load(target)
    assert reloaded.id == workflow.id
    assert [s.action for s in reloaded.steps] == ["navigate", "click"]


def test_invalid_yaml_is_reported(tmp_path):
    path = tmp_path / "bad.yaml"
    path.write_text("schema_version: [\n", encoding="utf-8")
    with pytest.raises(WorkflowLoadError, match="Invalid YAML"):
        WorkflowRepository().load(path)


def test_wrong_root_is_rejected(tmp_path):
    path = tmp_path / "list.yaml"
    path.write_text("- one\n- two\n", encoding="utf-8")
    with pytest.raises(WorkflowValidationError, match="root must be"):
        WorkflowRepository().load(path)


def test_missing_required_fields_reported(tmp_path):
    path = tmp_path / "missing.yaml"
    path.write_text("schema_version: 1\n", encoding="utf-8")
    with pytest.raises(WorkflowValidationError, match="schema validation failed"):
        WorkflowRepository().load(path)


def test_cache_invalidates_when_same_size_content_changes(tmp_path):
    path = tmp_path / "workflow.yaml"
    path.write_text("schema_version: 1\nid: demo\nname: Alpha\nsteps: []\n", encoding="utf-8")
    repo = WorkflowRepository(cache=WorkflowCache())
    assert repo.load(path).name == "Alpha"
    original = path.read_text(encoding="utf-8")
    changed = original.replace("Alpha", "Bravo")
    assert len(changed) == len(original)
    path.write_text(changed, encoding="utf-8")
    assert repo.load(path).name == "Bravo"


def test_cache_corruption_falls_back_to_yaml(tmp_path):
    path = tmp_path / "workflow.yaml"
    path.write_text("schema_version: 1\nid: demo\nname: Safe\nsteps: []\n", encoding="utf-8")
    disk = DiskWorkflowCache(tmp_path / "cache")
    repo = WorkflowRepository(disk_cache=disk)
    assert repo.load(path).name == "Safe"
    cache_path = disk._cache_path(path)
    cache_path.write_text("not json", encoding="utf-8")
    assert repo.load(path, use_cache=False).name == "Safe"


def test_deleted_file_does_not_return_stale_cache(tmp_path):
    path = tmp_path / "workflow.yaml"
    path.write_text("schema_version: 1\nid: demo\nname: Safe\nsteps: []\n", encoding="utf-8")
    repo = WorkflowRepository()
    repo.load(path)
    path.unlink()
    with pytest.raises(WorkflowLoadError):
        repo.load(path)


def test_safe_loader_does_not_construct_python_objects(tmp_path):
    path = tmp_path / "unsafe.yaml"
    path.write_text("!!python/object/apply:os.system ['echo unsafe']", encoding="utf-8")
    with pytest.raises(WorkflowLoadError):
        WorkflowRepository().load(path)

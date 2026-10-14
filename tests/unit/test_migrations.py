import pytest

from cobweb.domain.errors import WorkflowValidationError
from cobweb.persistence.migrations import migrate_workflow_data


def test_current_schema_is_preserved_without_mutating_input() -> None:
    original = {"schema_version": 1, "id": "demo", "metadata": {"tag": "x"}}
    result = migrate_workflow_data(original)
    assert result == original
    assert result is not original
    assert result["metadata"] is not original["metadata"]


@pytest.mark.parametrize("version", [0, -1])
def test_unsupported_old_schema_fails_clearly(version: int) -> None:
    with pytest.raises(WorkflowValidationError, match="No migration path"):
        migrate_workflow_data({"schema_version": version})


def test_future_schema_fails_clearly() -> None:
    with pytest.raises(WorkflowValidationError, match="newer than supported"):
        migrate_workflow_data({"schema_version": 999})


def test_missing_or_non_integer_schema_fails() -> None:
    with pytest.raises(WorkflowValidationError, match="requires an integer"):
        migrate_workflow_data({})
    with pytest.raises(WorkflowValidationError, match="requires an integer"):
        migrate_workflow_data({"schema_version": "1"})

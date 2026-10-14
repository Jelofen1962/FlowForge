import pytest
from pydantic import ValidationError
from cobweb.domain.workflow import Workflow


def base_data():
    return {"schema_version": 1, "id": "demo", "name": "Demo", "steps": []}


def test_valid_workflow_defaults():
    workflow = Workflow.model_validate(base_data())
    assert workflow.settings.browser == "chromium"
    assert workflow.steps == []


def test_duplicate_step_ids_rejected():
    data = base_data()
    data["steps"] = [
        {"id": "step-1", "action": "navigate", "url": "https://example.test"},
        {"id": "step-1", "action": "navigate", "url": "https://example.test"},
    ]
    with pytest.raises(ValidationError, match="unique"):
        Workflow.model_validate(data)


def test_unknown_action_rejected():
    data = base_data()
    data["steps"] = [{"id": "step-1", "action": "run_python"}]
    with pytest.raises(ValidationError, match="unsupported action"):
        Workflow.model_validate(data)


def test_role_locator_requires_role_and_name():
    data = base_data()
    data["steps"] = [{"id": "step-1", "action": "click", "target": {"by": "role", "role": "button"}}]
    with pytest.raises(ValidationError, match="require both"):
        Workflow.model_validate(data)


def test_future_schema_rejected():
    data = base_data()
    data["schema_version"] = 999
    with pytest.raises(ValidationError, match="supports 1"):
        Workflow.model_validate(data)

"""Explicit workflow schema migration hooks."""
from __future__ import annotations
from copy import deepcopy
from typing import Any
from cobweb.domain.workflow import CURRENT_SCHEMA_VERSION
from cobweb.domain.errors import WorkflowValidationError

def migrate_workflow_data(data: dict[str, Any]) -> dict[str, Any]:
    """Migrate known old schema versions; preserve callers' original data."""
    result = deepcopy(data)
    version = result.get("schema_version")
    if not isinstance(version, int):
        raise WorkflowValidationError("Workflow requires an integer 'schema_version'")
    if version > CURRENT_SCHEMA_VERSION:
        raise WorkflowValidationError(
            f"Workflow schema version {version} is newer than supported version {CURRENT_SCHEMA_VERSION}"
        )
    # Schema v1 is the initial supported schema. Add explicit vN -> vN+1 steps here.
    if version != CURRENT_SCHEMA_VERSION:
        raise WorkflowValidationError(f"No migration path exists from schema version {version}")
    return result

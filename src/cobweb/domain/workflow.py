"""Versioned workflow model."""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from cobweb.domain.action import WorkflowStep

CURRENT_SCHEMA_VERSION = 1

class WorkflowSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    browser: str = "chromium"
    headless: bool = False
    default_timeout_ms: int = Field(default=10_000, gt=0)
    navigation_timeout_ms: int = Field(default=30_000, gt=0)
    screenshot_on_failure: bool = True

class Workflow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = Field(ge=1)
    id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    name: str = Field(min_length=1)
    description: str = ""
    settings: WorkflowSettings = Field(default_factory=WorkflowSettings)
    variables: dict[str, Any] = Field(default_factory=dict)
    steps: list[WorkflowStep] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("schema_version")
    @classmethod
    def supported_schema_version(cls, value: int) -> int:
        if value != CURRENT_SCHEMA_VERSION:
            raise ValueError(
                f"unsupported schema_version {value}; this build supports {CURRENT_SCHEMA_VERSION}"
            )
        return value

    @field_validator("steps")
    @classmethod
    def unique_step_ids(cls, steps: list[WorkflowStep]) -> list[WorkflowStep]:
        ids = [step.id for step in steps]
        if len(ids) != len(set(ids)):
            raise ValueError("step IDs must be unique within a workflow")
        return steps

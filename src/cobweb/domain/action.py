"""Workflow step model and supported action names."""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator
from cobweb.domain.locator import Locator

SUPPORTED_ACTIONS = {
    "navigate", "click", "fill", "type_text", "select_option", "check", "uncheck",
    "press", "hover", "wait", "wait_for", "screenshot", "extract_text", "assert_text",
    "assert_visible", "assert_url", "scroll", "go_back", "reload",
}

TARGET_REQUIRED_ACTIONS = {
    "click", "fill", "type_text", "select_option", "check", "uncheck", "press", "hover",
    "wait_for", "extract_text", "assert_text", "assert_visible", "scroll",
}

class WorkflowStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    action: str = Field(min_length=1)
    target: Locator | None = None
    url: str | None = None
    value: Any = None
    state: str | None = None
    timeout_ms: int | None = Field(default=None, gt=0)
    params: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

    @model_validator(mode="after")
    def validate_action_fields(self) -> "WorkflowStep":
        if self.action not in SUPPORTED_ACTIONS:
            raise ValueError(f"unsupported action '{self.action}'")
        if self.action in TARGET_REQUIRED_ACTIONS and self.target is None:
            raise ValueError(f"action '{self.action}' requires a target locator")
        if self.action == "navigate" and not self.url:
            raise ValueError("action 'navigate' requires a non-empty url")
        if self.action in {"fill", "type_text", "select_option", "press"} and self.value is None:
            raise ValueError(f"action '{self.action}' requires a value")
        return self

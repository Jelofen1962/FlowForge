"""Typed locator definitions independent of Playwright and Qt."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

LocatorKind = Literal["role", "label", "placeholder", "text", "test_id", "css", "xpath"]

class Locator(BaseModel):
    model_config = ConfigDict(extra="forbid")
    by: LocatorKind
    value: str | None = None
    role: str | None = None
    name: str | None = None
    exact: bool = False
    frame: str | None = None
    index: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_locator_shape(self) -> "Locator":
        if self.by == "role":
            if not self.role or not self.name:
                raise ValueError("role locators require both 'role' and 'name'")
        elif not self.value:
            raise ValueError(f"{self.by} locators require a non-empty 'value'")
        return self

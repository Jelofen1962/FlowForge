"""The sole workflow YAML writer and canonical workflow loader."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
import yaml
from pydantic import ValidationError
from cobweb.domain.errors import WorkflowLoadError, WorkflowSaveError, WorkflowValidationError
from cobweb.domain.workflow import Workflow
from cobweb.persistence.atomic_write import atomic_write_text
from cobweb.persistence.cache import WorkflowCache, DiskWorkflowCache
from cobweb.persistence.migrations import migrate_workflow_data

LOGGER = logging.getLogger(__name__)

class WorkflowRepository:
    def __init__(self, cache: WorkflowCache | None = None,
                 disk_cache: DiskWorkflowCache | None = None) -> None:
        self.cache = cache or WorkflowCache()
        self.disk_cache = disk_cache

    def load(self, path: Path, use_cache: bool = True) -> Workflow:
        source = path.expanduser().resolve()
        if use_cache:
            cached = self.cache.get(source)
            if cached is not None:
                return cached
            if self.disk_cache:
                cached = self.disk_cache.get(source)
                if cached is not None:
                    self.cache.put(source, cached)
                    return cached.model_copy(deep=True)
        try:
            text = source.read_text(encoding="utf-8")
        except OSError as exc:
            raise WorkflowLoadError(f"Could not read workflow '{source}': {exc}") from exc
        try:
            raw: Any = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            mark = getattr(exc, "problem_mark", None)
            location = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
            raise WorkflowLoadError(f"Invalid YAML in '{source}'{location}: {exc}") from exc
        if not isinstance(raw, dict):
            raise WorkflowValidationError("Workflow YAML root must be a mapping/object")
        raw = migrate_workflow_data(raw)
        try:
            workflow = Workflow.model_validate(raw)
        except ValidationError as exc:
            details = "; ".join(
                f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
                for item in exc.errors()
            )
            raise WorkflowValidationError(f"Workflow schema validation failed: {details}") from exc
        if use_cache:
            self.cache.put(source, workflow)
            if self.disk_cache:
                self.disk_cache.put(source, workflow)
        return workflow.model_copy(deep=True)

    def save(self, path: Path, workflow: Workflow) -> Path:
        destination = path.expanduser().resolve()
        try:
            text = yaml.safe_dump(
                workflow.model_dump(mode="json", exclude_none=True),
                sort_keys=False, allow_unicode=True, default_flow_style=False,
            )
            atomic_write_text(destination, text)
        except WorkflowSaveError:
            raise
        except (OSError, yaml.YAMLError, TypeError, ValueError) as exc:
            raise WorkflowSaveError(f"Could not serialize workflow '{destination}': {exc}") from exc
        self.cache.invalidate(destination)
        if self.disk_cache:
            try:
                self.disk_cache._cache_path(destination).unlink(missing_ok=True)
            except OSError:
                pass
        return destination

    def import_workflow(self, source: Path, destination: Path) -> Path:
        workflow = self.load(source, use_cache=False)
        return self.save(destination, workflow)

    def export_workflow(self, source: Path, destination: Path) -> Path:
        return self.import_workflow(source, destination)

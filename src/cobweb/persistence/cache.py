"""Disposable parsed-workflow cache with source-content verification."""
from __future__ import annotations
import hashlib
import json
import logging
import os
import tempfile
from pathlib import Path
from pydantic import ValidationError
from cobweb.domain.workflow import Workflow, CURRENT_SCHEMA_VERSION

LOGGER = logging.getLogger(__name__)
CACHE_FORMAT_VERSION = 1

class WorkflowCache:
    """Small in-memory cache keyed by canonical path and full source fingerprint."""
    def __init__(self, enabled: bool = True, max_entries: int = 128) -> None:
        self.enabled = enabled
        self.max_entries = max(1, max_entries)
        self._entries: dict[str, tuple[str, Workflow]] = {}

    @staticmethod
    def fingerprint(path: Path) -> str:
        content = path.read_bytes()
        stat = path.stat()
        digest = hashlib.sha256(content).hexdigest()
        return f"{stat.st_mtime_ns}:{stat.st_size}:{digest}:schema={CURRENT_SCHEMA_VERSION}:cache={CACHE_FORMAT_VERSION}"

    def get(self, path: Path) -> Workflow | None:
        if not self.enabled:
            return None
        key = str(path.expanduser().resolve())
        try:
            fingerprint = self.fingerprint(Path(key))
        except OSError:
            self._entries.pop(key, None)
            return None
        entry = self._entries.get(key)
        if entry and entry[0] == fingerprint:
            LOGGER.debug("Workflow cache hit: %s", key)
            return entry[1].model_copy(deep=True)
        if entry:
            LOGGER.info("Workflow cache invalidated: %s", key)
            self._entries.pop(key, None)
        LOGGER.debug("Workflow cache miss: %s", key)
        return None

    def put(self, path: Path, workflow: Workflow) -> None:
        if not self.enabled:
            return
        key = str(path.expanduser().resolve())
        try:
            fingerprint = self.fingerprint(Path(key))
        except OSError:
            return
        if key not in self._entries and len(self._entries) >= self.max_entries:
            self._entries.pop(next(iter(self._entries)))
        self._entries[key] = (fingerprint, workflow.model_copy(deep=True))

    def invalidate(self, path: Path) -> None:
        self._entries.pop(str(path.expanduser().resolve()), None)

    def clear(self) -> None:
        self._entries.clear()

class DiskWorkflowCache:
    """Optional JSON cache. Cache errors are ignored; source YAML remains authoritative."""
    def __init__(self, cache_dir: Path, enabled: bool = True) -> None:
        self.cache_dir = cache_dir.expanduser().resolve()
        self.enabled = enabled

    def _cache_path(self, source: Path) -> Path:
        key = hashlib.sha256(str(source.expanduser().resolve()).encode("utf-8")).hexdigest()
        return self.cache_dir / f"{key}.json"

    def get(self, source: Path) -> Workflow | None:
        if not self.enabled:
            return None
        try:
            fingerprint = WorkflowCache.fingerprint(source)
            payload = json.loads(self._cache_path(source).read_text(encoding="utf-8"))
            if payload.get("cache_format_version") != CACHE_FORMAT_VERSION:
                return None
            if payload.get("fingerprint") != fingerprint:
                return None
            return Workflow.model_validate(payload["workflow"])
        except (OSError, ValueError, KeyError, TypeError, ValidationError) as exc:
            LOGGER.debug("Ignoring invalid workflow cache entry: %s", exc)
            return None

    def put(self, source: Path, workflow: Workflow) -> None:
        if not self.enabled:
            return
        temp_name: str | None = None
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            payload = {
                "cache_format_version": CACHE_FORMAT_VERSION,
                "fingerprint": WorkflowCache.fingerprint(source),
                "workflow": workflow.model_dump(mode="json"),
            }
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=self.cache_dir,
                                             prefix=".cache-", suffix=".tmp", delete=False) as handle:
                temp_name = handle.name
                json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, self._cache_path(source))
        except (OSError, ValueError, TypeError) as exc:
            LOGGER.debug("Could not write workflow cache; continuing without it: %s", exc)
            if temp_name:
                try:
                    Path(temp_name).unlink(missing_ok=True)
                except OSError:
                    pass

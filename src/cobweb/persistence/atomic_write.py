"""Atomic text writes to prevent partially written workflow files."""
from __future__ import annotations
import os
import tempfile
from pathlib import Path
from cobweb.domain.errors import WorkflowSaveError

def atomic_write_text(path: Path, text: str) -> None:
    path = path.expanduser().resolve()
    temp_name: str | None = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temp_name = handle.name
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except OSError as exc:
        if temp_name:
            try:
                Path(temp_name).unlink(missing_ok=True)
            except OSError:
                pass
        raise WorkflowSaveError(f"Could not save workflow to '{path}': {exc}") from exc

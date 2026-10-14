"""Domain-specific errors with actionable messages."""

class CobWebError(Exception):
    """Base class for expected application errors."""

class WorkflowLoadError(CobWebError):
    """Workflow could not be read or parsed."""

class WorkflowValidationError(CobWebError):
    """Workflow data violates the supported schema."""

class WorkflowSaveError(CobWebError):
    """Workflow could not be saved safely."""

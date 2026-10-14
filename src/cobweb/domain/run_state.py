"""Run states shared by UI and engine."""
from enum import StrEnum

class RunState(StrEnum):
    IDLE = "idle"
    PREPARING = "preparing"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"

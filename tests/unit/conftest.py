import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        normalized = item.nodeid.replace("\\", "/")
        if normalized.startswith("tests/unit/") or "/tests/unit/" in normalized:
            item.add_marker(pytest.mark.unit)

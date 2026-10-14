import pytest

try:
    from PySide6.QtWidgets import QApplication
except ImportError:
    QApplication = None  # type: ignore[assignment,misc]

pytestmark = pytest.mark.ui


@pytest.fixture(scope="module")
def qapp():
    if QApplication is None:
        pytest.skip("PySide6 is required for Qt UI tests")
    application = QApplication.instance() or QApplication([])
    yield application


def test_main_window_starts_with_clear_foundation_state(qapp) -> None:
    if QApplication is None:
        pytest.skip("PySide6 is required for Qt UI tests")
    from cobweb.app import MainWindow

    window = MainWindow()
    assert "CobWeb" in window.windowTitle()
    assert window.centralWidget() is not None
    assert window.size().width() >= 800
    window.close()

"""Qt application entry point."""

from __future__ import annotations

import argparse
import sys

from PySide6.QtWidgets import QApplication, QLabel, QMainWindow

from cobweb import __version__
from cobweb.bootstrap import initialize


class MainWindow(QMainWindow):
    """Minimal Phase 0 shell; feature panels are added in later phases."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(f"CobWeb {__version__}")
        self.resize(1100, 720)
        label = QLabel(
            "CobWeb foundation is running.\\n\\n"
            "Workflow editing, YAML persistence, browser execution, recording, "
            "and element picking arrive in later phases."
        )
        label.setWordWrap(True)
        label.setMargin(32)
        self.setCentralWidget(label)


def main() -> int:
    parser = argparse.ArgumentParser(description="CobWeb desktop application")
    parser.add_argument("--diagnostics", action="store_true", help="Print startup diagnostics and exit")
    args, qt_args = parser.parse_known_args()

    diagnostics = initialize()
    if args.diagnostics:
        for key, value in diagnostics.items():
            print(f"{key}: {value}")
        return 0

    app = QApplication([sys.argv[0], *qt_args])
    app.setApplicationName("CobWeb")
    app.setApplicationVersion(__version__)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())

"""``python -m torqa …`` → same entrypoint as the ``torqa`` CLI script."""

from __future__ import annotations

from src.cli.main import main

if __name__ == "__main__":
    raise SystemExit(main())

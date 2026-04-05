"""``python -m torqa …`` → same ``main()`` as the ``torqa`` executable (``[project.scripts]``)."""

from __future__ import annotations

from src.cli.main import main

if __name__ == "__main__":
    raise SystemExit(main())

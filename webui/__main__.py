"""
Run the Project-X web console: ``python -m webui`` or ``project-x-console``.
"""

from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="project-x-console",
        description="Project-X web console (FastAPI + static UI).",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("PROJECT_X_HOST", "127.0.0.1"),
        help="Bind address (default: 127.0.0.1 or PROJECT_X_HOST).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PROJECT_X_PORT", "8000")),
        help="Port (default: 8000 or PROJECT_X_PORT).",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload (recommended in production).",
    )
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(
        "webui.app:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
    )


if __name__ == "__main__":
    main()

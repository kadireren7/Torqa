#!/usr/bin/env python3
"""
CI: materialize golden IR to disk and run `npm install` + `npm run build` in generated/webapp.
Requires Node 18+ on the runner (ubuntu-latest includes it).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WEBAPP = REPO / ".ci_out" / "generated" / "webapp"


def main() -> int:
    sys.path.insert(0, str(REPO))
    from src.ir.canonical_ir import ir_goal_from_json
    from src.orchestrator.system_orchestrator import SystemOrchestrator
    from src.projection.projection_strategy import ProjectionContext

    bundle = json.loads(
        (REPO / "examples" / "core" / "valid_login_flow.json").read_text(encoding="utf-8")
    )
    g = ir_goal_from_json(bundle)
    orch = SystemOrchestrator(g, context=ProjectionContext(), engine_mode="python_only")
    out = orch.run_v4() if hasattr(orch, "run_v4") else orch.run()
    root = REPO / ".ci_out"
    if root.is_dir():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    for art in out.get("artifacts") or []:
        for fi in art.get("files") or []:
            fn = fi.get("filename")
            content = fi.get("content")
            if not fn or not isinstance(content, str):
                continue
            path = root / fn
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    if not (WEBAPP / "package.json").is_file():
        print("ci_build_generated_webapp: no generated/webapp/package.json", file=sys.stderr)
        return 1
    subprocess.run(["npm", "install"], cwd=str(WEBAPP), check=True)
    subprocess.run(["npm", "run", "build"], cwd=str(WEBAPP), check=True)
    print("ci_build_generated_webapp: OK", WEBAPP)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

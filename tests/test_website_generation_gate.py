"""CI gate: golden IR must produce the simple website file set (see artifact_builder)."""

from __future__ import annotations

import json
from pathlib import Path

from src.codegen.generation_quality import build_generation_quality_report
from src.ir.canonical_ir import ir_goal_from_json
from src.orchestrator.system_orchestrator import SystemOrchestrator
from src.projection.projection_strategy import ProjectionContext

REPO = Path(__file__).resolve().parents[1]


def test_login_flow_passes_website_generation_threshold():
    raw = json.loads((REPO / "examples/core/valid_login_flow.json").read_text(encoding="utf-8"))
    g = ir_goal_from_json(raw)
    orch = SystemOrchestrator(g, context=ProjectionContext(), engine_mode="python_only")
    out = orch.run_v4() if hasattr(orch, "run_v4") else orch.run()
    plan = out.get("projection_plan")
    artifacts = out.get("artifacts") or []
    rep = build_generation_quality_report(g, plan, artifacts)
    assert rep["readiness"]["passes_artifact_validation"], rep.get(
        "validate_generated_artifacts_errors"
    )
    assert rep["readiness"]["passes_website_threshold"], rep.get("website_threshold")

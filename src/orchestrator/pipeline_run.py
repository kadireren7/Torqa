"""
Shared full pipeline payload for web console and CLI (diagnostics + engine + orchestrator).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from src.diagnostics.report import build_full_diagnostic_report
from src.execution.engine_routing import run_rust_pipeline_with_fallback
from src.execution.trace_pack import build_execution_trace_for_run
from src.ir.canonical_ir import (
    IRGoal,
    compute_ir_fingerprint,
    ir_goal_to_json,
    validate_ir,
    validate_ir_handoff_compatibility,
)
from src.orchestrator.system_orchestrator import SystemOrchestrator
from src.projection.projection_graph import projection_graph_to_json
from src.projection.projection_strategy import ProjectionContext, projection_plan_to_json
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry


def build_console_run_payload(
    ir_goal: IRGoal,
    demo_inputs: Optional[Dict[str, Any]] = None,
    *,
    engine_mode: str = "rust_preferred",
    bundle_envelope_errors: Optional[list] = None,
) -> Dict[str, Any]:
    """Same structure as ``POST /api/run`` for CLI and HTTP reuse."""
    inputs = dict(demo_inputs or {})
    v_err = validate_ir(ir_goal)
    h_err = validate_ir_handoff_compatibility(ir_goal)
    reg = default_ir_function_registry()
    semantic = build_ir_semantic_report(ir_goal, reg)
    fp = compute_ir_fingerprint(ir_goal)
    diagnostics = build_full_diagnostic_report(
        ir_goal,
        bundle_envelope_errors=bundle_envelope_errors,
    )

    routing: Dict[str, Any] = {}
    rust_block: Dict[str, Any] = {}
    fallback: Dict[str, Any] = {}
    try:
        routing, rust_block, fallback = run_rust_pipeline_with_fallback(
            ir_goal,
            inputs,
            mode=engine_mode,
        )
    except Exception as ex:
        rust_block = {"error": str(ex)}

    orch = SystemOrchestrator(ir_goal, context=ProjectionContext(), engine_mode=engine_mode)
    orch_out = orch.run_v4() if hasattr(orch, "run_v4") else orch.run()

    ir_valid = len(v_err) == 0 and len(h_err) == 0
    plan = orch_out.get("projection_plan")
    graph = orch_out.get("graph")

    return {
        "ir_valid": ir_valid,
        "validation_errors": v_err,
        "handoff_errors": h_err,
        "fingerprint": fp,
        "semantic": semantic,
        "diagnostics": diagnostics,
        "execution_trace": build_execution_trace_for_run(ir_goal, rust_block, fallback),
        "engine": {
            "routing": routing,
            "rust_output": rust_block,
            "fallback": fallback,
        },
        "orchestrator": {
            "consistency_errors": orch_out.get("consistency_errors", []),
            "artifacts": orch_out.get("artifacts", []),
            "projection_plan": projection_plan_to_json(plan)["projection_plan"] if plan else None,
            "projection_graph": projection_graph_to_json(graph)["projection_graph"] if graph else None,
            "semantic": orch_out.get("semantic"),
            "manifest": orch_out.get("manifest"),
            "self_analysis_report": orch_out.get("self_analysis_report"),
        },
        "ir_bundle_echo": ir_goal_to_json(ir_goal),
    }

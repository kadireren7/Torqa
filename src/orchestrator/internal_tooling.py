"""
V4 internal tooling:
- inspection helpers
- self-analysis report
- maintenance/pruning helpers
"""

from __future__ import annotations

from typing import Any, Dict, List

from src.ir.canonical_ir import IRGoal, normalize_ir_goal
from src.projection.projection_graph import ProjectionGraph, projection_graph_to_json
from src.projection.projection_strategy import ProjectionPlan


def inspect_ir_goal(ir_goal: IRGoal) -> Dict[str, Any]:
    return {
        "goal": ir_goal.goal,
        "input_count": len(ir_goal.inputs),
        "precondition_count": len(ir_goal.preconditions),
        "forbid_count": len(ir_goal.forbids),
        "postcondition_count": len(ir_goal.postconditions),
        "transition_count": len(ir_goal.transitions),
        "has_result": bool((ir_goal.result or "").strip()),
        "metadata_keys": sorted(list(ir_goal.metadata.keys())),
    }


def inspect_projection_plan(plan: ProjectionPlan) -> Dict[str, Any]:
    return {
        "primary": {
            "language": plan.primary_target.language,
            "purpose": plan.primary_target.purpose,
            "confidence": plan.primary_target.confidence,
        },
        "secondary_count": len(plan.secondary_targets),
        "secondary_languages": [t.language for t in plan.secondary_targets],
        "strategy_notes_count": len(plan.strategy_notes),
    }


def inspect_projection_graph(graph: ProjectionGraph) -> Dict[str, Any]:
    g = projection_graph_to_json(graph)["projection_graph"]
    return {
        "node_count": len(g["nodes"]),
        "edge_count": len(g["edges"]),
        "relation_types": sorted({e["relation_type"] for e in g["edges"]}),
    }


def inspect_artifacts(artifacts: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_files = 0
    purposes: Dict[str, int] = {}
    for a in artifacts:
        total_files += len(a.get("files", []))
        p = a.get("purpose", "unknown")
        purposes[p] = purposes.get(p, 0) + 1
    return {
        "artifact_count": len(artifacts),
        "total_files": total_files,
        "purposes": dict(sorted(purposes.items())),
        "target_languages": sorted({a.get("target_language", "unknown") for a in artifacts}),
    }


def inspect_execution_result(result: Dict[str, Any]) -> Dict[str, Any]:
    ok = bool(result.get("success", False))
    executed = result.get("executed_transitions", result.get("executed_effects", []))
    return {
        "success": ok,
        "executed_count": len(executed),
        "has_errors": bool(result.get("errors")),
    }


def build_self_analysis_report(
    ir_goal: IRGoal,
    semantic_report: Dict[str, Any],
    projection_plan: ProjectionPlan,
    graph: ProjectionGraph,
    artifacts: List[Dict[str, Any]],
    execution_result: Dict[str, Any] | None = None,
    consistency_errors: List[str] | None = None,
) -> Dict[str, Any]:
    gt = semantic_report.get("guarantee_table", {})
    before_cov = len(gt.get("before", {}))
    after_cov = len(gt.get("after", {}))
    art_info = inspect_artifacts(artifacts)
    issues = []
    if not semantic_report.get("semantic_ok", False):
        issues.append("Semantic report contains errors.")
    if after_cov == 0 and len(ir_goal.transitions) > 0:
        issues.append("No after-state guarantees despite transitions.")
    if consistency_errors:
        issues.append("Projection consistency has reported issues.")
    if art_info["artifact_count"] == 0:
        issues.append("No artifacts generated.")

    return {
        "semantic_ok": bool(semantic_report.get("semantic_ok", False)),
        "guarantee_coverage": {
            "before": before_cov,
            "after": after_cov,
        },
        "projection_targets": [projection_plan.primary_target.language]
        + [t.language for t in projection_plan.secondary_targets],
        "artifact_summary": art_info,
        "consistency_ok": not bool(consistency_errors),
        "execution_ok": None if execution_result is None else bool(execution_result.get("success", False)),
        "weak_spots": issues,
        "system_notes": [
            "IR remains operational center.",
            "Python path is orchestration/fallback.",
            "Rust is preferred long-term semantic/execution engine.",
        ],
    }


def prune_unused_projection_targets(plan: ProjectionPlan) -> ProjectionPlan:
    # Keep only reasonably confident secondaries.
    pruned_secondary = [t for t in plan.secondary_targets if float(t.confidence) >= 0.50]
    plan.secondary_targets = pruned_secondary
    plan.strategy_notes.append("Pruned low-confidence secondary targets (<0.50).")
    return plan


def prune_empty_artifacts(artifacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for a in artifacts:
        files = [f for f in a.get("files", []) if str(f.get("content", "")).strip()]
        if files:
            a2 = dict(a)
            a2["files"] = files
            out.append(a2)
    return out


def prune_obsolete_metadata(ir_goal: IRGoal) -> IRGoal:
    n = normalize_ir_goal(ir_goal)
    md = dict(n.metadata)
    # Keep canonical metadata and source_map; drop accidental debug-only keys.
    keep = {"ir_version", "source", "canonical_language", "source_map"}
    n.metadata = {k: md[k] for k in md.keys() if k in keep}
    return n

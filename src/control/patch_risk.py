"""Heuristic risk scoring for JSON patch batches (structural / semantic / projection impact)."""

from __future__ import annotations

from typing import Any, Dict, List

from src.ir.canonical_ir import IRGoal


def score_patch_risk(ir_goal: IRGoal, mutation_dicts: List[Dict[str, Any]]) -> Dict[str, Any]:
    structural = 0.0
    semantic = 0.0
    projection = 0.0

    for m in mutation_dicts:
        mt = (m.get("mutation_type") or "").lower()
        if mt in {"remove_input", "remove_precondition", "remove_forbid", "remove_transition"}:
            structural += 0.25
            semantic += 0.2
            projection += 0.15
        elif mt in {"add_transition", "replace_expr"}:
            structural += 0.15
            semantic += 0.25
            projection += 0.2
        elif mt in {"add_precondition", "add_forbid"}:
            structural += 0.1
            semantic += 0.2
            projection += 0.1
        elif mt in {"add_input", "rename_identifier", "update_input_type"}:
            structural += 0.12
            semantic += 0.15
            projection += 0.18
        else:
            structural += 0.1
            semantic += 0.1
            projection += 0.1

    def clamp(x: float) -> float:
        return round(min(1.0, x), 4)

    return {
        "structural_impact": clamp(structural),
        "semantic_risk": clamp(semantic),
        "projection_impact": clamp(projection),
        "aggregate": clamp((structural + semantic + projection) / 3),
        "mutation_count": len(mutation_dicts),
        "note": "Heuristic scores for internal review; not security analysis.",
    }

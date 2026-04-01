"""Preview IR mutations without persisting (diff + diagnostics + risk)."""

from __future__ import annotations

from typing import Any, Dict, List

from src.control.ir_mutation import compute_ir_diff
from src.control.ir_mutation_json import try_apply_ir_mutations_from_json
from src.control.patch_risk import score_patch_risk
from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import IRGoal, ir_goal_to_json
from src.semantics.fix_suggestions import build_semantic_fix_suggestions
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry


def build_patch_preview_report(ir_goal: IRGoal, mutation_dicts: List[Dict[str, Any]]) -> Dict[str, Any]:
    new_goal, err = try_apply_ir_mutations_from_json(ir_goal, mutation_dicts)
    if err:
        return {"ok": False, "error": err, "proposed_ir_bundle": None, "diff": None}

    diff = compute_ir_diff(ir_goal, new_goal)
    diag = build_full_diagnostic_report(new_goal)
    reg = default_ir_function_registry()
    sem = build_ir_semantic_report(new_goal, reg)
    suggestions = build_semantic_fix_suggestions(new_goal, sem)
    risk = score_patch_risk(ir_goal, mutation_dicts)

    return {
        "ok": True,
        "error": None,
        "proposed_ir_bundle": ir_goal_to_json(new_goal),
        "diff": diff,
        "diagnostics": diag,
        "semantic_fix_suggestions": suggestions if not diag["ok"] else [],
        "patch_risk": risk,
    }

"""IR quality metrics (non-mutating assessment)."""

from __future__ import annotations

from typing import Any, Dict, List

from src.ir.canonical_ir import IRGoal, IRLogical, validate_ir_semantic_determinism
from src.projection.projection_strategy import analyze_ir_domains
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry


def build_ir_quality_report(ir_goal: IRGoal) -> Dict[str, Any]:
    reg = default_ir_function_registry()
    sem = build_ir_semantic_report(ir_goal, reg)
    domain = analyze_ir_domains(ir_goal)
    det = validate_ir_semantic_determinism(ir_goal)

    n_in = len(ir_goal.inputs)
    n_pre = len(ir_goal.preconditions)
    n_forb = len(ir_goal.forbids)
    n_post = len(ir_goal.postconditions)
    n_tr = len(ir_goal.transitions)
    logical_n = sum(
        1
        for sec in (ir_goal.preconditions, ir_goal.forbids, ir_goal.postconditions)
        for c in sec
        if isinstance(c.expr, IRLogical)
    )
    complexity = n_pre + n_forb + n_post + n_tr + (2 * logical_n)
    transition_density = n_tr / max(1, n_pre + n_forb + n_post + n_tr)

    before_g = sem.get("guarantee_table", {}).get("before", {})
    covered_ids = set()
    for _k, entries in before_g.items():
        for e in entries or []:
            if isinstance(e, dict) and e.get("identifier"):
                covered_ids.add(e["identifier"])
    input_names = {i.name for i in ir_goal.inputs}
    guarantee_coverage = (
        round(len(covered_ids & input_names) / max(1, len(input_names)), 4) if input_names else 1.0
    )

    return {
        "complexity_score": complexity,
        "transition_density": round(transition_density, 4),
        "guarantee_coverage_inputs": guarantee_coverage,
        "semantic_ok": bool(sem.get("semantic_ok")),
        "semantic_error_count": len(sem.get("errors") or []),
        "semantic_warning_count": len(sem.get("warnings") or []),
        "determinism_issue_count": len(det),
        "domain_profile": domain,
        "projection_readiness": {
            "semantic_clean": bool(sem.get("semantic_ok")),
            "has_transitions": n_tr > 0,
            "has_result_text": bool((ir_goal.result or "").strip()),
            "inputs_declared": n_in,
        },
        "condition_redundancy_hint": len(det) > 0,
    }

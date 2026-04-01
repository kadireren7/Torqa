"""
Unified execution trace for console / API: human-oriented step summaries + engine payload.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.ir.canonical_ir import IRGoal


def _transition_effect_name(ir_goal: IRGoal, transition_id: str) -> Optional[str]:
    for t in ir_goal.transitions:
        if t.transition_id == transition_id:
            return t.effect_name
    return None


def enrich_execution_step_dict(ir_goal: IRGoal, step: Dict[str, Any]) -> Dict[str, Any]:
    """Add ``summary`` (and ``effect_name`` for transitions) to a step dict."""
    kind = step.get("kind") or ""
    ref_id = step.get("ref_id") or ""
    out = dict(step)
    if kind == "precondition":
        out["summary"] = f"Precondition {ref_id}"
    elif kind == "forbid":
        out["summary"] = f"Forbid rule {ref_id}"
    elif kind == "transition":
        eff = _transition_effect_name(ir_goal, ref_id)
        if eff:
            out["effect_name"] = eff
            out["summary"] = f"Transition {ref_id} → effect {eff}"
        else:
            out["summary"] = f"Transition {ref_id}"
    elif kind == "finish":
        out["summary"] = "Finish"
    else:
        out["summary"] = f"{kind} {ref_id}".strip()
    return out


def enrich_plan_steps(ir_goal: IRGoal, steps: Optional[List[Any]]) -> List[Dict[str, Any]]:
    if not steps:
        return []
    out: List[Dict[str, Any]] = []
    for s in steps:
        if isinstance(s, dict):
            out.append(enrich_execution_step_dict(ir_goal, s))
        else:
            out.append(enrich_execution_step_dict(ir_goal, dict(s.__dict__)))
    return out


def build_execution_trace_for_run(
    ir_goal: IRGoal,
    rust_output: Dict[str, Any],
    fallback_status: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Single object for UI: prefer Python fallback execution (accurate step statuses);
    else Rust full_pipeline payload when bridge succeeded.
    """
    if fallback_status.get("used") and isinstance(fallback_status.get("python_result"), dict):
        py = fallback_status["python_result"]
        ex = py.get("execution") or {}
        raw_plan = ex.get("execution_plan") or {}
        steps = raw_plan.get("steps")
        return {
            "source": "python_fallback",
            "reason": fallback_status.get("reason"),
            "plan": {"steps": enrich_plan_steps(ir_goal, steps)},
            "result": ex.get("execution_result"),
            "note": None,
        }

    if rust_output and "error" not in rust_output:
        plan = rust_output.get("execution_plan")
        steps = None
        if isinstance(plan, dict):
            steps = plan.get("steps")
        elif plan is not None and hasattr(plan, "steps"):
            steps = [s.__dict__ if hasattr(s, "__dict__") else s for s in plan.steps]
        return {
            "source": "rust",
            "reason": None,
            "plan": {"steps": enrich_plan_steps(ir_goal, steps)},
            "result": rust_output.get("execution_result"),
            "note": None,
        }

    err = rust_output.get("error") if isinstance(rust_output, dict) else None
    return {
        "source": "none",
        "reason": err or fallback_status.get("reason"),
        "plan": None,
        "result": None,
        "note": "No execution trace available (engine unavailable or invalid).",
    }

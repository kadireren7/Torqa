"""
P127: Structured reliability pipeline for LLM → `.tq` generation.

Near-zero-error is **not** promised; this layer aggressively classifies failures, preserves attempt
logs, nudges repairs by failure kind, and reports first-pass vs repaired outcomes.

Taxonomy (``failure_kind`` on attempts):
- ``prompt_misunderstanding`` — model output is not the required JSON envelope (wrong keys, bad JSON).
- ``invalid_torqa_syntax`` — ``.tq`` text fails the TORQA parser.
- ``semantic_invalidity`` — IR lift or formal diagnostics reject the goal.
- ``poor_projection`` — IR → projection emitters fail (contract drift / unsupported IR shape).
- ``low_quality`` — parse + semantics OK but heuristic quality floor not met (P122/P126).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import IRGoal, ir_goal_from_json
from src.surface.parse_tq import TQParseError, parse_tq_source

FailureKind = Literal[
    "prompt_misunderstanding",
    "invalid_torqa_syntax",
    "semantic_invalidity",
    "poor_projection",
    "low_quality",
]

PIPELINE_STAGE_IDS: Tuple[str, ...] = (
    "prompt_interpretation",
    "planning",
    "tq_generation",
    "parse_validation",
    "semantic_validation",
    "projection_validation",
    "quality_validation",
)


def projection_validation_effective() -> bool:
    if (os.environ.get("TORQA_SKIP_PROJECTION_VALIDATION") or "").strip().lower() in ("1", "true", "yes"):
        return False
    return True


def validate_ir_projections(goal: IRGoal) -> Tuple[bool, str]:
    """Run P124-style emitters; any exception is a projection failure."""
    try:
        from src.projection.python.emit import ir_goal_python_projection
        from src.projection.rust.emit import ir_goal_rust_projection
        from src.projection.sql.emit import ir_goal_sql_projection
        from src.projection.typescript.emit import ir_goal_typescript_index_projection

        _ = ir_goal_typescript_index_projection(goal)
        _ = ir_goal_python_projection(goal)
        _ = ir_goal_rust_projection(goal)
        _ = ir_goal_sql_projection(goal)
    except Exception as ex:  # noqa: BLE001 — surface any projection regression as repairable
        return False, f"{type(ex).__name__}: {ex}"
    return True, ""


@dataclass
class TqValidationChainResult:
    ok: bool
    diagnostics: Optional[Dict[str, Any]]
    error_message: str
    failure_kind: Optional[FailureKind]
    """Highest stage reached (for telemetry)."""
    stage_reached: str
    goal: Optional[IRGoal] = None


def run_tq_validation_chain(
    text: str,
    *,
    synthetic_path: Path,
    run_projection: Optional[bool] = None,
) -> TqValidationChainResult:
    """
    Parse → IR → diagnostics → optional projection emit checks.
    Stops at first failure and returns a stable ``failure_kind`` for retry strategy.
    """
    if run_projection is None:
        run_projection = projection_validation_effective()

    try:
        bundle = parse_tq_source(text, tq_path=synthetic_path)
    except TQParseError as ex:
        return TqValidationChainResult(
            ok=False,
            diagnostics=None,
            error_message=f"{ex.code}: {ex}",
            failure_kind="invalid_torqa_syntax",
            stage_reached="parse_validation",
        )

    try:
        goal = ir_goal_from_json(bundle)
    except Exception as ex:  # noqa: BLE001
        return TqValidationChainResult(
            ok=False,
            diagnostics=None,
            error_message=f"IR shape: {ex}",
            failure_kind="semantic_invalidity",
            stage_reached="semantic_validation",
        )

    rep = build_full_diagnostic_report(goal)
    if not rep.get("ok", False):
        parts = [f"{i.get('code')}: {i.get('message')}" for i in (rep.get("issues") or [])[:10]]
        msg = "; ".join(parts) if parts else "diagnostics not ok"
        return TqValidationChainResult(
            ok=False,
            diagnostics=rep,
            error_message=msg,
            failure_kind="semantic_invalidity",
            stage_reached="semantic_validation",
            goal=goal,
        )

    if run_projection:
        pj_ok, pj_msg = validate_ir_projections(goal)
        if not pj_ok:
            return TqValidationChainResult(
                ok=False,
                diagnostics=rep,
                error_message=f"Projection validation: {pj_msg}",
                failure_kind="poor_projection",
                stage_reached="projection_validation",
                goal=goal,
            )

    return TqValidationChainResult(
        ok=True,
        diagnostics=rep,
        error_message="",
        failure_kind=None,
        stage_reached="projection_validation" if run_projection else "semantic_validation",
        goal=goal,
    )


def failure_aware_repair_nudge(failure_kind: Optional[str]) -> str:
    """Narrowed constraints appended to verifier feedback (P127)."""
    if failure_kind == "prompt_misunderstanding":
        return (
            "**P127 retry strategy (output envelope):** Reply with **only** valid JSON: "
            "a single object `{\"tq\": \"...\"}`. No markdown fences, no other top-level keys, "
            "no commentary. The `tq` string must be the full `.tq` file."
        )
    if failure_kind == "invalid_torqa_syntax":
        return (
            "**P127 retry strategy (TORQA syntax):** Use comma-separated `requires`, two-space-indented "
            "`flow:` steps only (`create session`, `emit login_success` variants), `intent` snake_case, "
            "`result` before `flow:`, and full-line `#` comments only outside the flow block."
        )
    if failure_kind == "semantic_invalidity":
        return (
            "**P127 retry strategy (semantics):** Satisfy every diagnostic code listed above; align "
            "`ensures` / `forbid` / transitions with the story and tq_v1 rules."
        )
    if failure_kind == "poor_projection":
        return (
            "**P127 retry strategy (projection):** Keep IR-compatible inputs and transition arguments; "
            "avoid exotic shapes — projections must emit TypeScript, Python, Rust, and SQL without error."
        )
    if failure_kind == "low_quality":
        return (
            "**P127 retry strategy (quality):** Expand product structure (module, requires, sections, flow) "
            "until quality dimensions meet the floor; do not trade completeness for brevity."
        )
    return ""


def compute_reliability_summary(
    attempts: List[Dict[str, Any]],
    *,
    ok: bool,
) -> Dict[str, Any]:
    """
    Aggregate telemetry for one generation run. Does **not** claim global error-free rates —
    only this invocation.
    """
    kinds_seen: List[str] = []
    for a in attempts:
        fk = a.get("failure_kind")
        if isinstance(fk, str) and fk:
            kinds_seen.append(fk)

    first_ok_idx: Optional[int] = None
    for i, a in enumerate(attempts):
        if a.get("status") == "ok":
            first_ok_idx = i
            break

    first_pass_success = bool(ok and first_ok_idx == 0)
    repaired_success = bool(ok and first_ok_idx is not None and first_ok_idx > 0)
    unrecoverable = not ok

    return {
        "disclaimer": (
            "Per-run telemetry only — not a guarantee of error-free generation. "
            "Rates describe this request's attempt sequence."
        ),
        "outcome": "success" if ok else "unrecoverable_failure",
        "first_pass_success": first_pass_success,
        "repaired_success": repaired_success,
        "unrecoverable_failure": unrecoverable,
        "rates": {
            "first_pass_success": 1.0 if first_pass_success else 0.0,
            "repaired_success": 1.0 if repaired_success else 0.0,
            "unrecoverable_failure": 1.0 if unrecoverable else 0.0,
        },
        "attempt_count": len(attempts),
        "failure_kinds_seen_in_order": kinds_seen,
        "first_successful_attempt_index": first_ok_idx,
    }

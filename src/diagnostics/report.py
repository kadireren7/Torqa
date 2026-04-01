from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.diagnostics.codes import annotate
from src.ir.canonical_ir import (
    IRGoal,
    validate_ir,
    validate_ir_handoff_compatibility,
    validate_ir_semantic_determinism,
)
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry


def build_full_diagnostic_report(
    ir_goal: IRGoal,
    *,
    bundle_envelope_errors: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Single structured report for CI, web UI, and AI self-correction loops.
    """
    structural = validate_ir(ir_goal)
    handoff = validate_ir_handoff_compatibility(ir_goal)
    determinism = validate_ir_semantic_determinism(ir_goal)
    reg = default_ir_function_registry()
    semantic = build_ir_semantic_report(ir_goal, reg)

    sem_err = list(semantic.get("errors") or [])
    sem_warn = list(semantic.get("warnings") or [])

    env_err = list(bundle_envelope_errors or [])

    issues: List[dict] = []
    issues.extend(annotate(env_err, phase="envelope"))
    issues.extend(annotate(structural, phase="structural"))
    issues.extend(annotate(handoff, phase="handoff"))
    issues.extend(annotate(determinism, phase="determinism"))
    issues.extend(annotate(sem_err, phase="semantic"))
    warnings = annotate(sem_warn, phase="semantic_warning")

    ok = (
        len(env_err) == 0
        and len(structural) == 0
        and len(handoff) == 0
        and len(determinism) == 0
        and len(sem_err) == 0
    )

    return {
        "ok": ok,
        "issues": issues,
        "warnings": warnings,
        "semantic_report": semantic,
    }

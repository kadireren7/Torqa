"""Rust vs Python engine parity packaging."""

from __future__ import annotations

from typing import Any, Dict, Optional

from src.execution.engine_routing import compare_rust_and_python_pipeline
from src.ir.canonical_ir import IRGoal


def build_engine_parity_report(
    ir_goal: IRGoal,
    demo_inputs: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Wraps compare_rust_and_python_pipeline with a stable report envelope.
    """
    inputs = dict(demo_inputs or {})
    raw = compare_rust_and_python_pipeline(ir_goal, inputs)
    return {
        "parity_ok": raw.get("parity_ok"),
        "checks": raw.get("checks"),
        "python_summary": raw.get("python"),
        "rust_summary": raw.get("rust"),
        "note": "Parity requires a working Rust toolchain and successful bridge execution.",
    }

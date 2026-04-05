"""Emit SQL-ish DDL + annotated IR trace from TORQA IR."""

from __future__ import annotations

import json
from typing import Any, List

from src.ir.canonical_ir import IRGoal, ir_expr_to_json


def ir_expr_compact(expr: Any) -> str:
    return json.dumps(ir_expr_to_json(expr), ensure_ascii=False, separators=(",", ":"))


def ir_goal_sql_projection(goal: IRGoal) -> str:
    lines: List[str] = []
    lines.append("-- Auto-generated from AI core IR.")
    lines.append("-- Do not treat as primary source — edit through the platform / core IR.")
    lines.append("")
    lines.append(f"-- Goal: {goal.goal}")
    if goal.result:
        lines.append(f"-- Result label: {goal.result}")
    lines.append("")
    lines.append("/* Inputs (workflow-facing columns) */")
    col_defs: List[str] = []
    for inp in sorted(goal.inputs, key=lambda x: x.name):
        sql_t = {"text": "TEXT", "number": "NUMERIC", "boolean": "BOOLEAN"}.get(
            inp.type_name, "TEXT"
        )
        col_defs.append(f"  {inp.name} {sql_t} NOT NULL")
    if col_defs:
        lines.append("CREATE TABLE IF NOT EXISTS workflow_inputs (")
        lines.append(",\n".join(col_defs))
        lines.append(");")
    else:
        lines.append("-- (no inputs declared)")
    lines.append("")
    for c in goal.preconditions:
        lines.append(f"-- require {c.condition_id}: {ir_expr_compact(c.expr)}")
    for c in goal.forbids:
        lines.append(f"-- forbid {c.condition_id}: {ir_expr_compact(c.expr)}")
    for t in goal.transitions:
        lines.append(
            f"-- effect {t.transition_id} {t.effect_name} {t.from_state}->{t.to_state} "
            f"args={json.dumps([ir_expr_compact(a) for a in t.arguments])}"
        )
    return "\n".join(lines) + "\n"

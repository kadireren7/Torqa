"""Emit Rust projection text from IR (TORQA → Rust)."""

from __future__ import annotations

import json

from src.ir.canonical_ir import IRGoal, ir_type_to_rust


def _rust_quoted(s: str) -> str:
    escaped = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def ir_goal_rust_projection(goal: IRGoal) -> str:
    lines = [
        "//! Auto-generated from AI core IR.",
        "//! Do not treat as primary source.",
        "",
        f"//! Goal: {goal.goal}",
    ]
    if goal.result:
        lines.append(f"//! Result: {goal.result}")
    lines.append("")
    lines.append("fn main() {")
    lines.append(f"    let goal: &str = {_rust_quoted(goal.goal)};")
    lines.append('    println!("goal={goal}");')
    if goal.result:
        lines.append(f"    let result_label: &str = {_rust_quoted(goal.result)};")
        lines.append('    println!("result_label={result_label}");')
    lines.append("}")
    lines.append("")
    lines.append("/* Mapped input types (conservative Rust): */")
    for inp in sorted(goal.inputs, key=lambda x: x.name):
        try:
            rt = ir_type_to_rust(inp.type_name)
        except ValueError:
            rt = "String"
        lines.append(f"// {inp.name}: {rt}")
    return "\n".join(lines) + "\n"

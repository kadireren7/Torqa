"""Emit Python projection text from IR (TORQA → Python)."""

from __future__ import annotations

import json

from src.ir.canonical_ir import IRGoal


def ir_goal_python_projection(goal: IRGoal) -> str:
    lines = [
        f"# Auto-generated from AI core IR (goal: {goal.goal}).",
        "# Do not treat as primary source — edit through the platform / core IR.",
        "",
    ]
    lines.append('"""IR-derived skeleton — behavior lives in verified core + runtime."""')
    lines.append("")
    lines.append(f"GOAL_NAME = {json.dumps(goal.goal)}")
    lines.append(f"RESULT_LABEL = {json.dumps(goal.result)}")
    lines.append("")
    lines.append("def describe() -> str:")
    lines.append(
        f"    return f\"goal={{GOAL_NAME!r}}, inputs={len(goal.inputs)}, "
        f"effects={len(goal.transitions)}\""
    )
    lines.append("")
    lines.append("def main() -> None:")
    lines.append("    print(describe())")
    lines.append("")
    lines.append('if __name__ == "__main__":')
    lines.append("    main()")
    lines.append("")
    return "\n".join(lines)

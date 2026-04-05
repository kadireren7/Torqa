"""Emit TypeScript projection text from IR (TORQA → TS)."""

from __future__ import annotations

import json
from typing import List

from src.ir.canonical_ir import IRGoal, ir_goal_to_json


def _header_lines(goal_name: str) -> List[str]:
    return [
        f"// Auto-generated from AI core IR (goal: {goal_name}).",
        "// Do not treat as primary source — edit through the platform / core IR.",
        "",
    ]


def ir_goal_typescript_index_projection(goal: IRGoal) -> str:
    bundle = ir_goal_to_json(goal)
    lines = _header_lines(goal.goal)
    lines.append("/** Embedded IR bundle for tooling / tests (read-only). */")
    lines.append(f"export const IR_GOAL_NAME = {json.dumps(goal.goal)};")
    lines.append(
        "export const IR_BUNDLE: Record<string, unknown> = "
        + json.dumps(bundle, ensure_ascii=False)
        + " as Record<string, unknown>;"
    )
    lines.append("")
    lines.append("export function describeFlow(): string {")
    lines.append(
        f"  return `Flow: ${{IR_GOAL_NAME}}, inputs: {len(goal.inputs)}, "
        f"requires: {len(goal.preconditions)}, forbids: {len(goal.forbids)}, "
        f"effects: {len(goal.transitions)}`;"
    )
    lines.append("}")
    lines.append("")
    return "\n".join(lines) + "\n"


def ir_goal_server_typescript_stub(goal: IRGoal) -> str:
    """Side-effect list derived from transitions (projection only)."""
    lines = _header_lines(goal.goal)
    effects = [json.dumps(t.effect_name) for t in goal.transitions]
    lines.append("/** Declared effect names from IR transitions (projection only). */")
    lines.append(f"export const DECLARED_EFFECTS = [{', '.join(effects)}] as const;")
    lines.append("")
    lines.append("export function runServerStub(): string {")
    lines.append('  return `effects: ${DECLARED_EFFECTS.join(", ")}`;')
    lines.append("}")
    lines.append("")
    return "\n".join(lines) + "\n"

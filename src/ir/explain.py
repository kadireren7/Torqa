"""Structured IR introspection (debugging / UI / tooling)."""

from __future__ import annotations

from typing import Any, Dict, List

from src.ir.canonical_ir import IRGoal, ir_condition_to_json, ir_expr_to_json, ir_transition_to_json


def explain_ir_conditions(ir_goal: IRGoal) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for c in ir_goal.preconditions:
        out.append(
            {
                "section": "preconditions",
                "condition_id": c.condition_id,
                "kind": c.kind,
                "expr_json": ir_condition_to_json(c),
            }
        )
    for c in ir_goal.forbids:
        out.append(
            {
                "section": "forbids",
                "condition_id": c.condition_id,
                "kind": c.kind,
                "expr_json": ir_condition_to_json(c),
            }
        )
    for c in ir_goal.postconditions:
        out.append(
            {
                "section": "postconditions",
                "condition_id": c.condition_id,
                "kind": c.kind,
                "expr_json": ir_condition_to_json(c),
            }
        )
    return out


def explain_ir_transitions(ir_goal: IRGoal) -> List[Dict[str, Any]]:
    return [
        {
            "transition_id": t.transition_id,
            "effect_name": t.effect_name,
            "from_state": t.from_state,
            "to_state": t.to_state,
            "arguments_json": [ir_expr_to_json(a) for a in t.arguments],
        }
        for t in ir_goal.transitions
    ]


def explain_ir_goal(ir_goal: IRGoal) -> Dict[str, Any]:
    return {
        "goal": ir_goal.goal,
        "result": ir_goal.result,
        "input_count": len(ir_goal.inputs),
        "inputs": [{"name": i.name, "type": i.type_name} for i in sorted(ir_goal.inputs, key=lambda x: x.name)],
        "precondition_count": len(ir_goal.preconditions),
        "forbid_count": len(ir_goal.forbids),
        "postcondition_count": len(ir_goal.postconditions),
        "transition_count": len(ir_goal.transitions),
        "metadata": ir_goal.metadata,
        "conditions": explain_ir_conditions(ir_goal),
        "transitions": explain_ir_transitions(ir_goal),
    }

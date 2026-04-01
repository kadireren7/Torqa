from __future__ import annotations

import copy
from typing import Any, Dict, List, Set, Tuple

from src.ir.canonical_ir import (
    IRBinary,
    IRBooleanLiteral,
    IRCall,
    IRCondition,
    IRExpr,
    IRGoal,
    IRIdentifier,
    IRLogical,
    IRTransition,
    ir_expr_to_json,
    normalize_ir_expr,
    normalize_ir_goal,
)
from src.semantics.ir_semantics import extract_ir_identifiers


def _expr_key(expr: IRExpr) -> str:
    return str(ir_expr_to_json(normalize_ir_expr(expr)))


def simplify_expr(expr):
    if isinstance(expr, IRLogical):
        left = simplify_expr(expr.left)
        right = simplify_expr(expr.right)
        op = expr.operator

        # A. Logical simplification rules requested in spec.
        if op == "and":
            if isinstance(right, IRBooleanLiteral) and right.value is True:
                return left
            if isinstance(left, IRBooleanLiteral) and left.value is True:
                return right
            # Safe constant fold.
            if isinstance(right, IRBooleanLiteral) and right.value is False:
                return IRBooleanLiteral(False)
            if isinstance(left, IRBooleanLiteral) and left.value is False:
                return IRBooleanLiteral(False)

        if op == "or":
            if isinstance(right, IRBooleanLiteral) and right.value is False:
                return left
            if isinstance(left, IRBooleanLiteral) and left.value is False:
                return right
            # Safe constant fold.
            if isinstance(right, IRBooleanLiteral) and right.value is True:
                return IRBooleanLiteral(True)
            if isinstance(left, IRBooleanLiteral) and left.value is True:
                return IRBooleanLiteral(True)

        return IRLogical(left, op, right)

    if isinstance(expr, IRBinary):
        return IRBinary(simplify_expr(expr.left), expr.operator, simplify_expr(expr.right))

    if isinstance(expr, IRCall):
        return IRCall(expr.name, [simplify_expr(a) for a in expr.arguments])

    return copy.deepcopy(expr)


def _remove_duplicate_conditions(conditions: List[IRCondition]) -> Tuple[List[IRCondition], int]:
    seen: Set[Tuple[str, str]] = set()
    out: List[IRCondition] = []
    removed = 0
    for c in conditions:
        key = (c.kind, _expr_key(c.expr))
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        out.append(IRCondition(c.condition_id, c.kind, c.expr))
    return out, removed


def remove_duplicates(ir_goal: IRGoal) -> Tuple[IRGoal, Dict[str, int]]:
    n = normalize_ir_goal(ir_goal)
    pre, pre_removed = _remove_duplicate_conditions(n.preconditions)
    forb, forb_removed = _remove_duplicate_conditions(n.forbids)
    post, post_removed = _remove_duplicate_conditions(n.postconditions)

    return (
        IRGoal(
            goal=n.goal,
            inputs=copy.deepcopy(n.inputs),
            preconditions=pre,
            forbids=forb,
            transitions=copy.deepcopy(n.transitions),
            postconditions=post,
            result=n.result,
            metadata=copy.deepcopy(n.metadata),
        ),
        {
            "preconditions": pre_removed,
            "forbids": forb_removed,
            "postconditions": post_removed,
            "total": pre_removed + forb_removed + post_removed,
        },
    )


def _is_boolean_literal(expr: IRExpr, value: bool) -> bool:
    return isinstance(expr, IRBooleanLiteral) and expr.value is value


def simplify_conditions(ir_goal: IRGoal) -> Tuple[IRGoal, Dict[str, int]]:
    n = normalize_ir_goal(ir_goal)
    simplified_expressions = 0
    removed_conditions = 0

    new_pre: List[IRCondition] = []
    for c in n.preconditions:
        old = _expr_key(c.expr)
        new_expr = simplify_expr(c.expr)
        if _expr_key(new_expr) != old:
            simplified_expressions += 1
        # C. Dead condition removal: require True does not affect execution.
        if _is_boolean_literal(new_expr, True):
            removed_conditions += 1
            continue
        new_pre.append(IRCondition(c.condition_id, c.kind, new_expr))

    new_forbids: List[IRCondition] = []
    for c in n.forbids:
        old = _expr_key(c.expr)
        new_expr = simplify_expr(c.expr)
        if _expr_key(new_expr) != old:
            simplified_expressions += 1
        # C. Dead condition removal: forbid False does not affect execution.
        if _is_boolean_literal(new_expr, False):
            removed_conditions += 1
            continue
        new_forbids.append(IRCondition(c.condition_id, c.kind, new_expr))

    new_posts: List[IRCondition] = []
    for c in n.postconditions:
        old = _expr_key(c.expr)
        new_expr = simplify_expr(c.expr)
        if _expr_key(new_expr) != old:
            simplified_expressions += 1
        # Dead postcondition: always true.
        if _is_boolean_literal(new_expr, True):
            removed_conditions += 1
            continue
        new_posts.append(IRCondition(c.condition_id, c.kind, new_expr))

    return (
        IRGoal(
            goal=n.goal,
            inputs=copy.deepcopy(n.inputs),
            preconditions=new_pre,
            forbids=new_forbids,
            transitions=copy.deepcopy(n.transitions),
            postconditions=new_posts,
            result=n.result,
            metadata=copy.deepcopy(n.metadata),
        ),
        {
            "simplified_expressions": simplified_expressions,
            "removed_dead_conditions": removed_conditions,
        },
    )


def _transition_signature(t: IRTransition) -> str:
    return str(
        {
            "effect_name": t.effect_name,
            "from_state": t.from_state,
            "to_state": t.to_state,
            "arguments": [ir_expr_to_json(normalize_ir_expr(a)) for a in t.arguments],
        }
    )


def prune_unused(ir_goal: IRGoal) -> Tuple[IRGoal, Dict[str, int]]:
    n = normalize_ir_goal(ir_goal)
    used_inputs: Set[str] = set()
    for c in n.preconditions + n.forbids + n.postconditions:
        used_inputs |= extract_ir_identifiers(c.expr)
    for t in n.transitions:
        for a in t.arguments:
            used_inputs |= extract_ir_identifiers(a)

    pruned_inputs = 0
    kept_inputs = []
    for inp in n.inputs:
        if inp.name in used_inputs:
            kept_inputs.append(copy.deepcopy(inp))
        else:
            pruned_inputs += 1

    # D. Redundant guarantees: duplicate equivalent transitions produce repeated guarantees.
    seen_t: Set[str] = set()
    new_transitions: List[IRTransition] = []
    removed_redundant_transitions = 0
    for t in n.transitions:
        sig = _transition_signature(t)
        if sig in seen_t:
            removed_redundant_transitions += 1
            continue
        seen_t.add(sig)
        new_transitions.append(copy.deepcopy(t))

    return (
        IRGoal(
            goal=n.goal,
            inputs=kept_inputs,
            preconditions=copy.deepcopy(n.preconditions),
            forbids=copy.deepcopy(n.forbids),
            transitions=new_transitions,
            postconditions=copy.deepcopy(n.postconditions),
            result=n.result,
            metadata=copy.deepcopy(n.metadata),
        ),
        {
            "pruned_inputs": pruned_inputs,
            "removed_redundant_transitions": removed_redundant_transitions,
            "total_pruned_targets": pruned_inputs + removed_redundant_transitions,
        },
    )


def run_ir_optimization_pipeline(ir_goal):
    ir = normalize_ir_goal(ir_goal)
    ir, _dup_report = remove_duplicates(ir)
    ir, _simp_report = simplify_conditions(ir)
    ir, _prune_report = prune_unused(ir)
    return normalize_ir_goal(ir)


def optimize_ir_goal(ir_goal) -> IRGoal:
    return run_ir_optimization_pipeline(ir_goal)


def optimize_ir_goal_with_report(ir_goal) -> Tuple[IRGoal, Dict[str, Any]]:
    ir = normalize_ir_goal(ir_goal)
    ir, dup_report = remove_duplicates(ir)
    ir, simp_report = simplify_conditions(ir)
    ir, prune_report = prune_unused(ir)
    ir = normalize_ir_goal(ir)

    report = {
        "removed_conditions": {
            "duplicates": dup_report["total"],
            "dead_conditions": simp_report["removed_dead_conditions"],
            "total": dup_report["total"] + simp_report["removed_dead_conditions"],
        },
        "simplified_expressions": simp_report["simplified_expressions"],
        "pruned_targets": {
            "inputs": prune_report["pruned_inputs"],
            "redundant_transitions": prune_report["removed_redundant_transitions"],
            "total": prune_report["total_pruned_targets"],
        },
    }
    return ir, report

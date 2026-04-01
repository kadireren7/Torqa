from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional

from src.ir.canonical_ir import (
    IRCall,
    IRCondition,
    IRExpr,
    IRGoal,
    IRIdentifier,
    IRInput,
    IRTransition,
    ir_condition_to_json,
    ir_expr_to_json,
    ir_goal_to_json,
    ir_transition_to_json,
    normalize_ir_goal,
    validate_ir,
)
from src.semantics.ir_semantics import default_ir_function_registry, validate_ir_semantics

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_ALLOWED_TYPES = {"text", "number", "boolean", "void", "unknown"}
_ALLOWED_STATES = {"before", "after"}


class IRMutation:
    def __init__(self, mutation_type, target, payload):
        self.mutation_type = mutation_type
        self.target = target
        self.payload = payload


def _clone_ir(ir_goal: IRGoal) -> IRGoal:
    return copy.deepcopy(ir_goal)


def _find_condition_index(conditions: List[IRCondition], condition_id: str) -> int:
    for i, c in enumerate(conditions):
        if c.condition_id == condition_id:
            return i
    return -1


def _find_transition_index(transitions: List[IRTransition], transition_id: str) -> int:
    for i, t in enumerate(transitions):
        if t.transition_id == transition_id:
            return i
    return -1


def _rename_in_expr(expr: IRExpr, old_name: str, new_name: str) -> IRExpr:
    if isinstance(expr, IRIdentifier):
        return IRIdentifier(new_name if expr.name == old_name else expr.name, expr.semantic_type)
    if isinstance(expr, IRCall):
        return IRCall(expr.name, [_rename_in_expr(a, old_name, new_name) for a in expr.arguments])
    if hasattr(expr, "left") and hasattr(expr, "right") and hasattr(expr, "operator"):
        left = _rename_in_expr(expr.left, old_name, new_name)
        right = _rename_in_expr(expr.right, old_name, new_name)
        expr_copy = copy.deepcopy(expr)
        expr_copy.left = left
        expr_copy.right = right
        return expr_copy
    return copy.deepcopy(expr)


def validate_ir_mutation(ir_goal, mutation) -> List[str]:
    errors: List[str] = []
    if not isinstance(mutation, IRMutation):
        return ["Mutation must be an IRMutation instance."]
    mt = mutation.mutation_type
    target = mutation.target
    payload = mutation.payload

    supported = {
        "add_input",
        "remove_input",
        "update_input_type",
        "add_precondition",
        "remove_precondition",
        "add_forbid",
        "remove_forbid",
        "add_transition",
        "remove_transition",
        "replace_expr",
        "rename_identifier",
    }
    if mt not in supported:
        errors.append(f"Unsupported mutation_type: {mt!r}.")
        return errors

    input_names = {i.name for i in ir_goal.inputs}
    pre_ids = {c.condition_id for c in ir_goal.preconditions}
    forbid_ids = {c.condition_id for c in ir_goal.forbids}
    trans_ids = {t.transition_id for t in ir_goal.transitions}

    if mt == "add_input":
        name = (payload or {}).get("name")
        type_name = (payload or {}).get("type_name")
        if not name or not _IDENT_RE.match(name):
            errors.append("add_input: payload.name must be a valid identifier.")
        if name in input_names:
            errors.append(f"add_input: input {name!r} already exists.")
        if type_name not in _ALLOWED_TYPES:
            errors.append(f"add_input: payload.type_name {type_name!r} is invalid.")

    elif mt == "remove_input":
        if target not in input_names:
            errors.append(f"remove_input: target input {target!r} does not exist.")

    elif mt == "update_input_type":
        if target not in input_names:
            errors.append(f"update_input_type: target input {target!r} does not exist.")
        type_name = (payload or {}).get("type_name")
        if type_name not in _ALLOWED_TYPES:
            errors.append(f"update_input_type: payload.type_name {type_name!r} is invalid.")

    elif mt == "add_precondition":
        cid = (payload or {}).get("condition_id")
        if not cid:
            errors.append("add_precondition: payload.condition_id is required.")
        if cid in pre_ids or cid in forbid_ids:
            errors.append(f"add_precondition: condition_id {cid!r} already exists.")
        if not isinstance((payload or {}).get("expr"), object):
            errors.append("add_precondition: payload.expr is required.")

    elif mt == "remove_precondition":
        if target not in pre_ids:
            errors.append(f"remove_precondition: target condition_id {target!r} does not exist.")

    elif mt == "add_forbid":
        cid = (payload or {}).get("condition_id")
        if not cid:
            errors.append("add_forbid: payload.condition_id is required.")
        if cid in pre_ids or cid in forbid_ids:
            errors.append(f"add_forbid: condition_id {cid!r} already exists.")

    elif mt == "remove_forbid":
        if target not in forbid_ids:
            errors.append(f"remove_forbid: target condition_id {target!r} does not exist.")

    elif mt == "add_transition":
        tid = (payload or {}).get("transition_id")
        if not tid:
            errors.append("add_transition: payload.transition_id is required.")
        if tid in trans_ids:
            errors.append(f"add_transition: transition_id {tid!r} already exists.")
        if not (payload or {}).get("effect_name"):
            errors.append("add_transition: payload.effect_name is required.")
        if (payload or {}).get("from_state") not in _ALLOWED_STATES:
            errors.append("add_transition: from_state must be 'before' or 'after'.")
        if (payload or {}).get("to_state") not in _ALLOWED_STATES:
            errors.append("add_transition: to_state must be 'before' or 'after'.")

    elif mt == "remove_transition":
        if target not in trans_ids:
            errors.append(f"remove_transition: target transition_id {target!r} does not exist.")

    elif mt == "replace_expr":
        if not isinstance(target, dict):
            errors.append("replace_expr: target must be a dict with section and id.")
        else:
            section = target.get("section")
            if section not in {"preconditions", "forbids", "postconditions"}:
                errors.append("replace_expr: target.section must be preconditions|forbids|postconditions.")
            if not target.get("id"):
                errors.append("replace_expr: target.id is required.")
        if "expr" not in (payload or {}):
            errors.append("replace_expr: payload.expr is required.")

    elif mt == "rename_identifier":
        old_name = target
        new_name = (payload or {}).get("new_name")
        if old_name not in input_names:
            errors.append(f"rename_identifier: source identifier {old_name!r} not found in inputs.")
        if not new_name or not _IDENT_RE.match(new_name):
            errors.append("rename_identifier: payload.new_name must be a valid identifier.")
        if new_name in input_names:
            errors.append(f"rename_identifier: target identifier {new_name!r} already exists.")

    if errors:
        return errors

    # Simulate apply and run semantic checks for safety.
    try:
        mutated = apply_ir_mutation(ir_goal, mutation)
    except Exception as ex:
        return [f"Mutation application failed: {ex}"]

    structural_errors = validate_ir(mutated)
    semantic_errors, _warnings = validate_ir_semantics(mutated, default_ir_function_registry())
    errors.extend(structural_errors)
    errors.extend(semantic_errors)
    return errors


def apply_ir_mutation(ir_goal, mutation: IRMutation) -> IRGoal:
    current = _clone_ir(ir_goal)
    mt = mutation.mutation_type
    target = mutation.target
    payload = mutation.payload or {}

    if mt == "add_input":
        current.inputs.append(IRInput(payload["name"], payload["type_name"]))
    elif mt == "remove_input":
        current.inputs = [i for i in current.inputs if i.name != target]
    elif mt == "update_input_type":
        for i in current.inputs:
            if i.name == target:
                i.type_name = payload["type_name"]
                break
    elif mt == "add_precondition":
        current.preconditions.append(IRCondition(payload["condition_id"], "require", payload["expr"]))
    elif mt == "remove_precondition":
        current.preconditions = [c for c in current.preconditions if c.condition_id != target]
    elif mt == "add_forbid":
        current.forbids.append(IRCondition(payload["condition_id"], "forbid", payload["expr"]))
    elif mt == "remove_forbid":
        current.forbids = [c for c in current.forbids if c.condition_id != target]
    elif mt == "add_transition":
        current.transitions.append(
            IRTransition(
                payload["transition_id"],
                payload["effect_name"],
                list(payload.get("arguments", [])),
                payload["from_state"],
                payload["to_state"],
            )
        )
    elif mt == "remove_transition":
        current.transitions = [t for t in current.transitions if t.transition_id != target]
    elif mt == "replace_expr":
        section = target["section"]
        item_id = target["id"]
        expr = payload["expr"]
        group = getattr(current, section)
        idx = _find_condition_index(group, item_id)
        if idx < 0:
            raise ValueError(f"replace_expr target not found: {section}.{item_id}")
        group[idx] = IRCondition(group[idx].condition_id, group[idx].kind, expr)
    elif mt == "rename_identifier":
        old_name = target
        new_name = payload["new_name"]
        for inp in current.inputs:
            if inp.name == old_name:
                inp.name = new_name
        for c in current.preconditions:
            c.expr = _rename_in_expr(c.expr, old_name, new_name)
        for c in current.forbids:
            c.expr = _rename_in_expr(c.expr, old_name, new_name)
        for c in current.postconditions:
            c.expr = _rename_in_expr(c.expr, old_name, new_name)
        for t in current.transitions:
            t.arguments = [_rename_in_expr(a, old_name, new_name) for a in t.arguments]
    else:
        raise ValueError(f"Unsupported mutation_type: {mt!r}")

    return normalize_ir_goal(current)


def apply_ir_mutation_batch(ir_goal, mutations: List[IRMutation]) -> IRGoal:
    original = _clone_ir(ir_goal)
    current = _clone_ir(ir_goal)
    for idx, m in enumerate(mutations):
        errs = validate_ir_mutation(current, m)
        if errs:
            raise ValueError(f"Batch mutation failed at index {idx}: {' | '.join(errs)}")
        current = apply_ir_mutation(current, m)
    # rollback semantics: function is pure; failure raises before returning.
    _ = original
    return normalize_ir_goal(current)


def compute_ir_diff(old_ir, new_ir) -> Dict[str, Any]:
    old_json = ir_goal_to_json(old_ir)["ir_goal"]
    new_json = ir_goal_to_json(new_ir)["ir_goal"]

    def by_key(items: List[Dict[str, Any]], key: str) -> Dict[str, Dict[str, Any]]:
        return {str(i[key]): i for i in items}

    old_inputs = by_key(old_json["inputs"], "name")
    new_inputs = by_key(new_json["inputs"], "name")
    old_pre = by_key(old_json["preconditions"], "condition_id")
    new_pre = by_key(new_json["preconditions"], "condition_id")
    old_forbids = by_key(old_json["forbids"], "condition_id")
    new_forbids = by_key(new_json["forbids"], "condition_id")
    old_trans = by_key(old_json["transitions"], "transition_id")
    new_trans = by_key(new_json["transitions"], "transition_id")

    def diff_maps(old_map: Dict[str, Any], new_map: Dict[str, Any]) -> Dict[str, Any]:
        added = sorted([new_map[k] for k in new_map.keys() - old_map.keys()], key=lambda x: json_key(x))
        removed = sorted([old_map[k] for k in old_map.keys() - new_map.keys()], key=lambda x: json_key(x))
        changed = []
        for k in sorted(old_map.keys() & new_map.keys()):
            if old_map[k] != new_map[k]:
                changed.append({"id": k, "old": old_map[k], "new": new_map[k]})
        return {"added": added, "removed": removed, "changed": changed}

    def json_key(item: Dict[str, Any]) -> str:
        if "name" in item:
            return item["name"]
        if "condition_id" in item:
            return item["condition_id"]
        if "transition_id" in item:
            return item["transition_id"]
        return str(item)

    return {
        "added": {
            "inputs": diff_maps(old_inputs, new_inputs)["added"],
            "preconditions": diff_maps(old_pre, new_pre)["added"],
            "forbids": diff_maps(old_forbids, new_forbids)["added"],
            "transitions": diff_maps(old_trans, new_trans)["added"],
        },
        "removed": {
            "inputs": diff_maps(old_inputs, new_inputs)["removed"],
            "preconditions": diff_maps(old_pre, new_pre)["removed"],
            "forbids": diff_maps(old_forbids, new_forbids)["removed"],
            "transitions": diff_maps(old_trans, new_trans)["removed"],
        },
        "changed": {
            "inputs": diff_maps(old_inputs, new_inputs)["changed"],
            "preconditions": diff_maps(old_pre, new_pre)["changed"],
            "forbids": diff_maps(old_forbids, new_forbids)["changed"],
            "transitions": diff_maps(old_trans, new_trans)["changed"],
        },
    }

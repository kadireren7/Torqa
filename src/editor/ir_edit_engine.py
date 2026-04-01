from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional, Tuple

from src.ir.canonical_ir import (
    IRCondition,
    IRExpr,
    IRGoal,
    IRIdentifier,
    IRInput,
    IRTransition,
    compute_ir_fingerprint,
    ir_expr_from_json,
    normalize_ir_goal,
    validate_ir,
    validate_ir_semantic_determinism,
)
from src.control.control_layer import (
    MutationPolicy,
    evaluate_mutation_policy,
    run_guardrails,
    score_mutation_risk,
    validate_evolution,
)
from src.control.ir_mutation import compute_ir_diff
from src.semantics.ir_semantics import default_ir_function_registry, validate_ir_semantics


_SEGMENT_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$")


class IREditOperation:
    def __init__(
        self,
        op_type,
        target_path,
        payload,
        operation_id: Optional[str] = None,
        editor_metadata: Optional[Dict[str, Any]] = None,
    ):
        self.op_type = op_type
        self.target_path = target_path
        self.payload = payload or {}
        self.operation_id = operation_id
        self.editor_metadata = editor_metadata or {}


class IREditTransaction:
    def __init__(self, operations):
        self.operations = operations
        self.status = "pending"


class IREditHistory:
    def __init__(self):
        self.stack = []

    def push(self, ir_goal):
        self.stack.append(copy.deepcopy(ir_goal))

    def undo(self):
        if not self.stack:
            raise ValueError("History is empty, cannot undo.")
        return self.stack.pop()


def _clone_ir(ir_goal: IRGoal) -> IRGoal:
    return copy.deepcopy(ir_goal)


def _coerce_expr(x: Any) -> IRExpr:
    if isinstance(x, IRExpr):
        return x
    if isinstance(x, dict):
        return ir_expr_from_json(x)
    raise TypeError(f"Expected IRExpr or expr JSON dict, got {type(x)!r}")


def _parse_path(path: str) -> List[Tuple[str, Optional[int]]]:
    if not path or not isinstance(path, str):
        raise ValueError("target_path must be a non-empty string.")
    segments: List[Tuple[str, Optional[int]]] = []
    for raw in path.split("."):
        m = _SEGMENT_RE.match(raw)
        if not m:
            raise ValueError(f"Invalid path segment {raw!r} in target_path {path!r}.")
        name = m.group(1)
        index = int(m.group(2)) if m.group(2) is not None else None
        segments.append((name, index))
    return segments


def _list_match_token(item: Any, token: str) -> bool:
    if isinstance(item, IRInput):
        return item.name == token
    if isinstance(item, IRCondition):
        return item.condition_id == token
    if isinstance(item, IRTransition):
        return item.transition_id == token
    if isinstance(item, dict):
        return token in item
    return False


def _resolve_from_list(items: List[Any], token: str) -> Any:
    if token.isdigit():
        idx = int(token)
        if idx < 0 or idx >= len(items):
            raise IndexError(f"List index {idx} out of range.")
        return items[idx]
    for item in items:
        if _list_match_token(item, token):
            return item
    raise KeyError(f"List target {token!r} not found.")


def _resolve_path(root: Any, path: str) -> Any:
    current = root
    for name, index in _parse_path(path):
        if isinstance(current, list):
            current = _resolve_from_list(current, name)
        elif isinstance(current, dict):
            if name not in current:
                raise KeyError(f"Key {name!r} not found while resolving path {path!r}.")
            current = current[name]
        else:
            if not hasattr(current, name):
                raise AttributeError(f"Attribute {name!r} not found while resolving path {path!r}.")
            current = getattr(current, name)

        if index is not None:
            if not isinstance(current, list):
                raise TypeError(f"Segment {name}[{index}] targets a non-list object.")
            if index < 0 or index >= len(current):
                raise IndexError(f"List index {index} out of range at segment {name}[{index}].")
            current = current[index]
    return current


def _resolve_parent_and_leaf(root: Any, path: str) -> Tuple[Any, str, Optional[int]]:
    segments = _parse_path(path)
    if len(segments) == 1:
        parent = root
    else:
        parent_path = ".".join(
            [f"{n}[{i}]" if i is not None else n for n, i in segments[:-1]]
        )
        parent = _resolve_path(root, parent_path)
    leaf_name, leaf_index = segments[-1]
    return parent, leaf_name, leaf_index


def _rename_expr(expr: IRExpr, old_name: str, new_name: str) -> IRExpr:
    if isinstance(expr, IRIdentifier):
        return IRIdentifier(new_name if expr.name == old_name else expr.name, expr.semantic_type)
    expr_copy = copy.deepcopy(expr)
    if hasattr(expr_copy, "arguments"):
        expr_copy.arguments = [_rename_expr(a, old_name, new_name) for a in expr_copy.arguments]
    if hasattr(expr_copy, "left") and hasattr(expr_copy, "right"):
        expr_copy.left = _rename_expr(expr_copy.left, old_name, new_name)
        expr_copy.right = _rename_expr(expr_copy.right, old_name, new_name)
    return expr_copy


def _set_path_value(root: Any, path: str, value: Any) -> None:
    parent, leaf_name, leaf_index = _resolve_parent_and_leaf(root, path)
    if isinstance(parent, list):
        target = _resolve_from_list(parent, leaf_name)
        idx = parent.index(target)
        parent[idx] = value
        return

    if isinstance(parent, dict):
        if leaf_name not in parent:
            raise KeyError(f"Key {leaf_name!r} not found for assignment.")
        if leaf_index is None:
            parent[leaf_name] = value
        else:
            if not isinstance(parent[leaf_name], list):
                raise TypeError(f"Path leaf {leaf_name!r} is not a list.")
            parent[leaf_name][leaf_index] = value
        return

    if not hasattr(parent, leaf_name):
        raise AttributeError(f"Attribute {leaf_name!r} not found for assignment.")
    target = getattr(parent, leaf_name)
    if leaf_index is None:
        setattr(parent, leaf_name, value)
        return
    if not isinstance(target, list):
        raise TypeError(f"Path leaf {leaf_name!r} is not a list.")
    target[leaf_index] = value


def _remove_from_path(root: Any, path: str) -> None:
    parent, leaf_name, leaf_index = _resolve_parent_and_leaf(root, path)
    if isinstance(parent, list):
        target = _resolve_from_list(parent, leaf_name)
        parent.remove(target)
        return
    if isinstance(parent, dict):
        target = parent.get(leaf_name)
        if target is None:
            raise KeyError(f"Key {leaf_name!r} not found for removal.")
        if leaf_index is None:
            del parent[leaf_name]
        else:
            if not isinstance(target, list):
                raise TypeError(f"Path leaf {leaf_name!r} is not a list.")
            del target[leaf_index]
        return

    if not hasattr(parent, leaf_name):
        raise AttributeError(f"Attribute {leaf_name!r} not found for removal.")
    target = getattr(parent, leaf_name)
    if leaf_index is None:
        if isinstance(target, list):
            raise ValueError("Cannot remove a list attribute directly, target an item instead.")
        raise ValueError("Cannot remove non-list object directly without a list target.")
    if not isinstance(target, list):
        raise TypeError(f"Path leaf {leaf_name!r} is not a list.")
    del target[leaf_index]


def _apply_single_operation(ir_goal: IRGoal, operation: IREditOperation) -> IRGoal:
    updated = _clone_ir(ir_goal)
    payload = operation.payload or {}
    op_type = operation.op_type

    if op_type == "add_input":
        name = payload.get("name")
        type_name = payload.get("type_name")
        updated.inputs.append(IRInput(name, type_name))

    elif op_type == "remove_input":
        _remove_from_path(updated, operation.target_path)

    elif op_type == "update_expr":
        expr = payload.get("expr", payload)
        _set_path_value(updated, operation.target_path, expr)

    elif op_type == "replace_transition":
        if isinstance(payload, IRTransition):
            replacement = payload
        else:
            replacement = IRTransition(
                payload["transition_id"],
                payload["effect_name"],
                list(payload.get("arguments", [])),
                payload["from_state"],
                payload["to_state"],
            )
        _set_path_value(updated, operation.target_path, replacement)

    elif op_type == "add_precondition":
        cid = str(payload["condition_id"])
        expr = _coerce_expr(payload["expr"])
        updated.preconditions.append(IRCondition(cid, "require", expr))

    elif op_type == "remove_precondition":
        _remove_from_path(updated, operation.target_path)

    elif op_type == "add_forbid":
        cid = str(payload["condition_id"])
        expr = _coerce_expr(payload["expr"])
        updated.forbids.append(IRCondition(cid, "forbid", expr))

    elif op_type == "remove_forbid":
        _remove_from_path(updated, operation.target_path)

    elif op_type == "add_transition":
        args = [_coerce_expr(a) for a in payload.get("arguments", [])]
        updated.transitions.append(
            IRTransition(
                str(payload["transition_id"]),
                str(payload["effect_name"]),
                args,
                str(payload["from_state"]),
                str(payload["to_state"]),
            )
        )

    elif op_type == "remove_transition":
        _remove_from_path(updated, operation.target_path)

    elif op_type == "change_input_type":
        target_obj = _resolve_path(updated, operation.target_path)
        if not isinstance(target_obj, IRInput):
            raise TypeError("change_input_type target must resolve to an IRInput.")
        target_obj.type_name = str(payload["type_name"])

    elif op_type == "update_result":
        text = payload.get("text")
        if text is None and "result" in payload:
            text = payload.get("result")
        updated.result = None if text is None else str(text)

    elif op_type == "reorder_transitions":
        i = int(payload["from_index"])
        j = int(payload["to_index"])
        ts = updated.transitions
        if i < 0 or j < 0 or i >= len(ts) or j >= len(ts):
            raise IndexError("reorder_transitions: index out of range.")
        ts[i], ts[j] = ts[j], ts[i]

    elif op_type == "rename_identifier":
        new_name = payload.get("new_name")
        target_obj = _resolve_path(updated, operation.target_path)
        if isinstance(target_obj, IRInput):
            old_name = target_obj.name
        elif isinstance(target_obj, IRIdentifier):
            old_name = target_obj.name
        else:
            old_name = str(operation.target_path.split(".")[-1])

        for inp in updated.inputs:
            if inp.name == old_name:
                inp.name = new_name
        for c in updated.preconditions:
            c.expr = _rename_expr(c.expr, old_name, new_name)
        for c in updated.forbids:
            c.expr = _rename_expr(c.expr, old_name, new_name)
        for c in updated.postconditions:
            c.expr = _rename_expr(c.expr, old_name, new_name)
        for t in updated.transitions:
            t.arguments = [_rename_expr(a, old_name, new_name) for a in t.arguments]

    else:
        raise ValueError(f"Unsupported edit operation type: {op_type!r}")

    return normalize_ir_goal(updated)


def validate_edit(ir_goal, operation):
    errors: List[str] = []
    if not isinstance(operation, IREditOperation):
        return ["Operation must be an IREditOperation instance."]

    skip_path_ops = {
        "add_input",
        "add_precondition",
        "add_forbid",
        "add_transition",
        "update_result",
        "reorder_transitions",
    }
    if operation.op_type not in {
        "add_input",
        "remove_input",
        "update_expr",
        "replace_transition",
        "rename_identifier",
        "add_precondition",
        "remove_precondition",
        "add_forbid",
        "remove_forbid",
        "add_transition",
        "remove_transition",
        "change_input_type",
        "update_result",
        "reorder_transitions",
    }:
        return [f"Unsupported operation type {operation.op_type!r}."]

    try:
        if operation.op_type not in skip_path_ops:
            _ = _resolve_path(ir_goal, operation.target_path)
        elif operation.op_type == "add_precondition":
            _ = _resolve_path(ir_goal, operation.target_path or "preconditions")
        elif operation.op_type == "add_forbid":
            _ = _resolve_path(ir_goal, operation.target_path or "forbids")
        elif operation.op_type == "add_transition":
            _ = _resolve_path(ir_goal, operation.target_path or "transitions")
        elif operation.op_type == "reorder_transitions":
            _ = _resolve_path(ir_goal, "transitions")
        elif operation.op_type == "update_result":
            if not hasattr(ir_goal, "result"):
                raise AttributeError("IRGoal has no result field.")
    except Exception as ex:
        errors.append(f"Path resolution failed: {ex}")
        return errors

    try:
        candidate = _apply_single_operation(ir_goal, operation)
    except Exception as ex:
        errors.append(f"Operation apply failed: {ex}")
        return errors

    structural = validate_ir(candidate)
    semantic, _warnings = validate_ir_semantics(candidate, default_ir_function_registry())
    determinism = validate_ir_semantic_determinism(candidate)
    errors.extend(structural)
    errors.extend(semantic)
    errors.extend(determinism)
    return errors


def apply_edit_transaction(ir_goal, transaction) -> Tuple[IRGoal, Dict[str, Any]]:
    if not isinstance(transaction, IREditTransaction):
        raise ValueError("transaction must be an IREditTransaction instance.")

    before = normalize_ir_goal(_clone_ir(ir_goal))
    current = _clone_ir(before)
    report: Dict[str, Any] = {
        "status": "failed",
        "errors": [],
        "operations_applied": 0,
        "diff": {},
        "mutation_risks": [],
        "guardrail_checks": [],
        "policy_checks": [],
        "fingerprint_before": compute_ir_fingerprint(before),
        "fingerprint_after": None,
    }
    policy = MutationPolicy()

    try:
        for idx, op in enumerate(transaction.operations):
            allowed, reason = evaluate_mutation_policy(op, current, policy)
            report["policy_checks"].append(
                {"index": idx, "operation": op.op_type, "allowed": allowed, "reason": reason}
            )
            if not allowed:
                raise ValueError(
                    f"Operation #{idx} ({op.op_type}) blocked by policy: {reason}"
                )

            risk = score_mutation_risk(op, current)
            report["mutation_risks"].append(
                {"index": idx, "operation": op.op_type, "risk_score": risk}
            )

            op_errors = validate_edit(current, op)
            if op_errors:
                raise ValueError(f"Operation #{idx} ({op.op_type}) invalid: {' | '.join(op_errors)}")
            candidate = _apply_single_operation(current, op)
            guardrail_results = run_guardrails(current, candidate, op)
            report["guardrail_checks"].append(
                {
                    "index": idx,
                    "operation": op.op_type,
                    "results": guardrail_results,
                }
            )
            failed_guardrails = [r for r in guardrail_results if not r["passed"]]
            if failed_guardrails:
                reasons = " | ".join(f"{g['name']}: {g['reason']}" for g in failed_guardrails)
                raise ValueError(
                    f"Operation #{idx} ({op.op_type}) failed safety guardrails: {reasons}"
                )
            current = candidate
            report["operations_applied"] += 1

        current = normalize_ir_goal(current)
        final_structural = validate_ir(current)
        final_semantic, final_warnings = validate_ir_semantics(
            current, default_ir_function_registry()
        )
        final_determinism = validate_ir_semantic_determinism(current)
        evolution_errors = validate_evolution(before, current)
        final_errors = final_structural + final_semantic + final_determinism + evolution_errors
        if final_errors:
            raise ValueError("Post-transaction validation failed: " + " | ".join(final_errors))

        transaction.status = "committed"
        report["status"] = "committed"
        report["warnings"] = list(final_warnings)
        report["diff"] = compute_ir_diff(before, current)
        report["fingerprint_after"] = compute_ir_fingerprint(current)
        return current, report
    except Exception as ex:
        transaction.status = "rolled_back"
        report["status"] = "rolled_back"
        report["errors"].append(str(ex))
        report["diff"] = compute_ir_diff(before, before)
        report["fingerprint_after"] = compute_ir_fingerprint(before)
        return before, report


def print_edit_transaction_report(report: Dict[str, Any]) -> None:
    print("--- IR Edit Engine ---")
    print("--- Control Layer ---")
    for p in report.get("policy_checks", []):
        verdict = "allowed" if p.get("allowed") else "blocked"
        print(f"[policy] op#{p.get('index')} {p.get('operation')}: {verdict} ({p.get('reason')})")
    print("--- Mutation Risk ---")
    for r in report.get("mutation_risks", []):
        print(f"[risk] op#{r.get('index')} {r.get('operation')}: {r.get('risk_score')}")
    print("--- Guardrail Checks ---")
    for batch in report.get("guardrail_checks", []):
        for gr in batch.get("results", []):
            status = "PASS" if gr.get("passed") else "FAIL"
            print(
                f"[guardrail] op#{batch.get('index')} {batch.get('operation')} "
                f"{gr.get('name')}: {status} ({gr.get('reason')})"
            )
    print("--- Transaction Result ---")
    print(f"Status: {report.get('status')}")
    print(f"Operations applied: {report.get('operations_applied', 0)}")
    if report.get("errors"):
        print("Errors:")
        for e in report["errors"]:
            print(f"- {e}")
    if report.get("warnings"):
        print("Warnings:")
        for w in report["warnings"]:
            print(f"- {w}")
    print("--- Edit Diff ---")
    print(report.get("diff", {}))

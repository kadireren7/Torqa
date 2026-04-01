from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from src.ir.canonical_ir import IRGoal
from src.semantics.ir_semantics import default_ir_function_registry, validate_ir_semantics


class MutationPolicy:
    def __init__(self):
        self.allowed_operations = set()
        self.blocked_operations = set()


def evaluate_mutation_policy(
    operation, ir_goal, policy: Optional[MutationPolicy] = None
) -> Tuple[bool, str]:
    _ = ir_goal
    policy = policy or MutationPolicy()
    op_type = getattr(operation, "op_type", None)
    if not op_type:
        return False, "Operation is missing op_type."
    if op_type in policy.blocked_operations:
        return False, f"Operation {op_type!r} is blocked by policy."
    if policy.allowed_operations and op_type not in policy.allowed_operations:
        return False, f"Operation {op_type!r} is not in allowed_operations."
    return True, "Allowed by mutation policy."


def score_mutation_risk(operation, ir_goal) -> float:
    score = 0.0
    op_type = getattr(operation, "op_type", "")
    target_path = str(getattr(operation, "target_path", "") or "")
    payload = getattr(operation, "payload", {}) or {}

    # Touches core logic?
    if target_path.startswith(("preconditions", "forbids", "postconditions", "transitions")):
        score += 0.3

    # Affects guarantees?
    if target_path.startswith(("preconditions", "transitions")):
        score += 0.25
    if op_type in {"replace_transition", "update_expr"}:
        score += 0.15

    # Affects execution path?
    if target_path.startswith("transitions") or op_type == "replace_transition":
        score += 0.25

    # High-impact identifiers?
    risky_names = {"username", "password", "session", "audit_log", "result"}
    target_lower = target_path.lower()
    if any(name in target_lower for name in risky_names):
        score += 0.1
    if isinstance(payload, dict):
        payload_text = " ".join(str(v).lower() for v in payload.values())
        if any(name in payload_text for name in risky_names):
            score += 0.1

    # Remove operations are generally riskier than additive edits.
    if op_type.startswith("remove"):
        score += 0.2
    elif op_type.startswith("rename"):
        score += 0.15

    # Larger IRs increase blast radius for identifier-level changes.
    if op_type == "rename_identifier" and len(getattr(ir_goal, "inputs", [])) > 5:
        score += 0.1

    return max(0.0, min(1.0, score))


class SafetyGuardrail:
    def __init__(self, name, check_fn):
        self.name = name
        self.check_fn = check_fn


def _guardrail_no_removal_of_all_preconditions(
    ir_goal_before: IRGoal, ir_goal_after: IRGoal, operation: Any
) -> Tuple[bool, str]:
    _ = operation
    if ir_goal_before.preconditions and not ir_goal_after.preconditions:
        return False, "All preconditions were removed."
    return True, "Preconditions are not fully removed."


def _guardrail_no_empty_execution_flow(
    ir_goal_before: IRGoal, ir_goal_after: IRGoal, operation: Any
) -> Tuple[bool, str]:
    _ = ir_goal_before
    _ = operation
    if not ir_goal_after.transitions and not (ir_goal_after.result or "").strip():
        return False, "Execution flow is empty: no transitions and empty result."
    return True, "Execution flow is non-empty."


def _guardrail_no_unverified_transition(
    ir_goal_before: IRGoal, ir_goal_after: IRGoal, operation: Any
) -> Tuple[bool, str]:
    _ = ir_goal_before
    _ = operation
    errors, _warnings = validate_ir_semantics(ir_goal_after, default_ir_function_registry())
    transition_semantic_errors = [e for e in errors if "transition" in e.lower() or "effect" in e.lower()]
    if transition_semantic_errors:
        return False, "Transition semantic verification failed."
    return True, "Transitions verified semantically."


def default_safety_guardrails() -> List[SafetyGuardrail]:
    return [
        SafetyGuardrail("no_removal_of_all_preconditions", _guardrail_no_removal_of_all_preconditions),
        SafetyGuardrail("no_empty_execution_flow", _guardrail_no_empty_execution_flow),
        SafetyGuardrail("no_unverified_transition", _guardrail_no_unverified_transition),
    ]


def validate_evolution(ir_goal_before, ir_goal_after):
    errors: List[str] = []
    if not ir_goal_after.inputs:
        errors.append("Evolution invalid: all inputs removed.")
    if ir_goal_before.transitions and not ir_goal_after.transitions:
        errors.append("Evolution invalid: transitions fully removed from non-empty flow.")
    if ir_goal_before.preconditions and not ir_goal_after.preconditions:
        errors.append("Evolution invalid: all preconditions removed.")
    if not (ir_goal_after.result or "").strip() and not ir_goal_after.transitions:
        errors.append("Evolution invalid: no resulting behavior remains.")
    return errors


def run_guardrails(
    ir_goal_before, ir_goal_after, operation, guardrails: Optional[List[SafetyGuardrail]] = None
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    guardrails = guardrails or default_safety_guardrails()
    for g in guardrails:
        ok, reason = g.check_fn(ir_goal_before, ir_goal_after, operation)
        results.append({"name": g.name, "passed": bool(ok), "reason": reason})
    return results

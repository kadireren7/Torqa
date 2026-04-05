"""P112: deterministic IR logic validation (reachability, ordering, termination)."""

from __future__ import annotations

from src.ir.canonical_ir import (
    IRBinary,
    IRCall,
    IRCondition,
    IRGoal,
    IRIdentifier,
    IRInput,
    IRNumberLiteral,
    IRStringLiteral,
    IRTransition,
    ir_goal_from_json,
)
from src.semantics.ir_logic_validation import validate_ir_goal_logic
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry


def _minimal_goal(**kwargs) -> IRGoal:
    base = {
        "goal": "TestFlow",
        "inputs": [{"name": "username", "type": "text"}, {"name": "password", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0001",
                "kind": "require",
                "expr": {"type": "call", "name": "exists", "arguments": [{"type": "identifier", "name": "username"}]},
            }
        ],
        "forbids": [],
        "transitions": [],
        "postconditions": [],
        "result": "OK",
        "metadata": {
            "ir_version": "1.4",
            "source": "test",
            "canonical_language": "english",
            "source_map": {"available": True, "prototype_only": True, "surface": "tq_v1"},
        },
    }
    base.update(kwargs)
    return ir_goal_from_json({"ir_goal": base})


def test_logic_ok_for_typical_login_order():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "start_session",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "before",
                "to_state": "after",
            },
            {
                "transition_id": "t_0002",
                "effect_name": "log_successful_login",
                "arguments": [
                    {"type": "identifier", "name": "username"},
                    {"type": "identifier", "name": "password"},
                ],
                "from_state": "after",
                "to_state": "after",
            },
        ],
    )
    assert validate_ir_goal_logic(g) == []


def test_unreachable_second_before_edge():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "start_session",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "before",
                "to_state": "after",
            },
            {
                "transition_id": "t_0002",
                "effect_name": "reset_failed_attempts",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "before",
                "to_state": "after",
            },
        ],
    )
    errs = validate_ir_goal_logic(g)
    assert len(errs) == 1
    assert "is unreachable" in errs[0]


def test_log_before_session_rejected():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "log_successful_login",
                "arguments": [
                    {"type": "identifier", "name": "username"},
                    {"type": "identifier", "name": "password"},
                ],
                "from_state": "before",
                "to_state": "after",
            },
            {
                "transition_id": "t_0002",
                "effect_name": "start_session",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "after",
                "to_state": "after",
            },
        ],
    )
    errs = validate_ir_goal_logic(g)
    assert any("start_session must appear before log_successful_login" in e for e in errs)


def test_postcondition_requires_start_session():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "log_successful_login",
                "arguments": [
                    {"type": "identifier", "name": "username"},
                    {"type": "identifier", "name": "password"},
                ],
                "from_state": "before",
                "to_state": "after",
            },
        ],
        postconditions=[
            {
                "condition_id": "c_post_0001",
                "kind": "postcondition",
                "expr": {
                    "type": "call",
                    "name": "session_stored_for_user",
                    "arguments": [{"type": "identifier", "name": "username"}],
                },
            }
        ],
    )
    errs = validate_ir_goal_logic(g)
    assert any("session_stored_for_user" in e and "start_session" in e for e in errs)


def test_postcondition_chain_must_end_after():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "start_session",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "before",
                "to_state": "before",
            },
        ],
        postconditions=[
            {
                "condition_id": "c_post_0001",
                "kind": "postcondition",
                "expr": {
                    "type": "call",
                    "name": "session_stored_for_user",
                    "arguments": [{"type": "identifier", "name": "username"}],
                },
            }
        ],
    )
    errs = validate_ir_goal_logic(g)
    assert any("does not end in state" in e and "after" in e for e in errs)


def test_contradictory_equals_preconditions():
    g = _minimal_goal(
        preconditions=[
            {
                "condition_id": "c_req_0001",
                "kind": "require",
                "expr": {
                    "type": "binary",
                    "operator": "==",
                    "left": {"type": "identifier", "name": "username"},
                    "right": {"type": "string_literal", "value": "a"},
                },
            },
            {
                "condition_id": "c_req_0002",
                "kind": "require",
                "expr": {
                    "type": "binary",
                    "operator": "==",
                    "left": {"type": "identifier", "name": "username"},
                    "right": {"type": "string_literal", "value": "b"},
                },
            },
        ],
    )
    errs = validate_ir_goal_logic(g)
    assert any("contradictory preconditions" in e for e in errs)


def test_logic_required_effects_metadata():
    g = _minimal_goal(
        metadata={
            "ir_version": "1.4",
            "source": "test",
            "canonical_language": "english",
            "source_map": {
                "available": True,
                "prototype_only": True,
                "logic_required_effects": ["start_session"],
            },
        },
    )
    errs = validate_ir_goal_logic(g)
    assert any("logic_required_effects" in e for e in errs)


def test_tq_model_unknown_input():
    g = _minimal_goal(
        metadata={
            "ir_version": "1.4",
            "source": "test",
            "canonical_language": "english",
            "source_map": {
                "available": True,
                "prototype_only": True,
                "tq_model": [{"name": "nope", "shape": "scalar", "type": "string"}],
            },
        },
    )
    errs = validate_ir_goal_logic(g)
    assert any("tq_model" in e and "nope" in e for e in errs)


def test_semantic_report_includes_logic_flags():
    g = _minimal_goal(
        transitions=[
            {
                "transition_id": "t_0001",
                "effect_name": "start_session",
                "arguments": [{"type": "identifier", "name": "username"}],
                "from_state": "before",
                "to_state": "after",
            },
        ],
    )
    reg = default_ir_function_registry()
    rep = build_ir_semantic_report(g, reg)
    assert rep.get("logic_ok") is True
    assert rep.get("logic_errors") == []

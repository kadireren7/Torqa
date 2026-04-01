"""
Apply IR mutations from JSON API payloads (expr fields as dict trees).
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple

from src.control.ir_mutation import IRMutation, apply_ir_mutation_batch
from src.ir.canonical_ir import IRGoal, ir_expr_from_json


def ir_mutation_from_dict(obj: Dict[str, Any]) -> IRMutation:
    if not isinstance(obj, dict):
        raise TypeError("mutation must be a dict")
    mt = obj.get("mutation_type")
    if not mt:
        raise ValueError("mutation_type is required")
    return IRMutation(mt, obj.get("target"), copy.deepcopy(obj.get("payload", {})))


def _hydrate_payload(m: IRMutation) -> IRMutation:
    p = copy.deepcopy(m.payload) or {}
    mt = m.mutation_type
    if mt in ("add_precondition", "add_forbid", "replace_expr"):
        ex = p.get("expr")
        if isinstance(ex, dict):
            p["expr"] = ir_expr_from_json(ex)
    if mt == "add_transition":
        raw_args = p.get("arguments", [])
        if raw_args and isinstance(raw_args[0], dict):
            p["arguments"] = [ir_expr_from_json(a) for a in raw_args]
    return IRMutation(m.mutation_type, m.target, p)


def apply_ir_mutations_from_json(ir_goal: IRGoal, mutation_dicts: List[Dict[str, Any]]) -> IRGoal:
    mutations = [_hydrate_payload(ir_mutation_from_dict(d)) for d in mutation_dicts]
    return apply_ir_mutation_batch(ir_goal, mutations)


def try_apply_ir_mutations_from_json(
    ir_goal: IRGoal, mutation_dicts: List[Dict[str, Any]]
) -> Tuple[Optional[IRGoal], Optional[str]]:
    try:
        return apply_ir_mutations_from_json(ir_goal, mutation_dicts), None
    except (ValueError, TypeError, KeyError) as ex:
        return None, str(ex)

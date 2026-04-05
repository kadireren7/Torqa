"""
P124: Canonical semantic digest of an IR goal for cross-target parity checks.

TORQA IR is the source of truth; projections must preserve these fields consistently
(allowing only syntax/framework differences in emitted code).
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.ir.canonical_ir import IRGoal


def ir_semantic_fingerprint(goal: IRGoal) -> Dict[str, Any]:
    """Stable, JSON-serializable summary — sort keys/lists for determinism."""
    transitions: List[Tuple[str, str, str]] = []
    for t in goal.transitions:
        transitions.append((t.effect_name, t.from_state, t.to_state))
    transitions.sort()
    return {
        "goal": goal.goal,
        "result": goal.result,
        "inputs_sorted": sorted(inp.name for inp in goal.inputs),
        "precondition_ids_sorted": sorted(c.condition_id for c in goal.preconditions),
        "forbid_ids_sorted": sorted(c.condition_id for c in goal.forbids),
        "transitions_sorted": [list(x) for x in transitions],
    }

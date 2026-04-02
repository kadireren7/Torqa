"""
Static taxonomy lists for ``language_reference_payload`` / ``torqa language``.

Source: ``examples/torqa_self/language_reference_taxonomy.tq`` → committed bundle.
Slug → interchange string is bridged here (TORQA carries order and identity only).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "language_reference_taxonomy_bundle.json"

_CORE_INPUTS = 3
_GROUP_SIZES = (5, 2, 7, 6, 2, 4)

_TAXONOMY_SLUG_ORDER: tuple[str, ...] = (
    "itype_text",
    "itype_number",
    "itype_boolean",
    "itype_void",
    "itype_unknown",
    "tstate_before",
    "tstate_after",
    "expr_identifier",
    "expr_string_literal",
    "expr_number_literal",
    "expr_boolean_literal",
    "expr_call",
    "expr_binary",
    "expr_logical",
    "binop_eq",
    "binop_ne",
    "binop_lt",
    "binop_gt",
    "binop_le",
    "binop_ge",
    "logop_and",
    "logop_or",
    "fphase_syntax",
    "fphase_kind_type",
    "fphase_wellformed",
    "fphase_policy",
)

_VALUE_BY_SLUG: Dict[str, str] = {
    "itype_text": "text",
    "itype_number": "number",
    "itype_boolean": "boolean",
    "itype_void": "void",
    "itype_unknown": "unknown",
    "tstate_before": "before",
    "tstate_after": "after",
    "expr_identifier": "identifier",
    "expr_string_literal": "string_literal",
    "expr_number_literal": "number_literal",
    "expr_boolean_literal": "boolean_literal",
    "expr_call": "call",
    "expr_binary": "binary",
    "expr_logical": "logical",
    "binop_eq": "==",
    "binop_ne": "!=",
    "binop_lt": "<",
    "binop_gt": ">",
    "binop_le": "<=",
    "binop_ge": ">=",
    "logop_and": "and",
    "logop_or": "or",
    "fphase_syntax": "syntax",
    "fphase_kind_type": "kind_type",
    "fphase_wellformed": "wellformed",
    "fphase_policy": "policy",
}

_FALLBACK_LISTS: Dict[str, List[str]] = {
    "input_types": ["text", "number", "boolean", "void", "unknown"],
    "transition_states": ["before", "after"],
    "expr_json_types": [
        "identifier",
        "string_literal",
        "number_literal",
        "boolean_literal",
        "call",
        "binary",
        "logical",
    ],
    "binary_operators": ["==", "!=", "<", ">", "<=", ">="],
    "logical_operators": ["and", "or"],
    "formal_validation_phases": ["syntax", "kind_type", "wellformed", "policy"],
}

_KEYS_IN_ORDER = (
    "input_types",
    "transition_states",
    "expr_json_types",
    "binary_operators",
    "logical_operators",
    "formal_validation_phases",
)


def _lists_from_taxonomy_slugs(slugs: List[str]) -> Optional[Dict[str, List[str]]]:
    if tuple(slugs) != _TAXONOMY_SLUG_ORDER:
        return None
    o = 0
    out: Dict[str, List[str]] = {}
    for key, sz in zip(_KEYS_IN_ORDER, _GROUP_SIZES, strict=True):
        chunk = slugs[o : o + sz]
        out[key] = [_VALUE_BY_SLUG[s] for s in chunk]
        o += sz
    return out


def language_reference_taxonomy_lists(*, bundle_path: Optional[Path] = None) -> Optional[Dict[str, List[str]]]:
    """Return six taxonomy lists from bundle, or ``None`` if invalid."""
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return None
    names = ir_goal_input_names(ig)
    need = _CORE_INPUTS + len(_TAXONOMY_SLUG_ORDER)
    if len(names) < need:
        return None
    tax = names[_CORE_INPUTS:need]
    return _lists_from_taxonomy_slugs(tax)


def language_reference_taxonomy_lists_with_fallback(*, bundle_path: Optional[Path] = None) -> Dict[str, List[str]]:
    got = language_reference_taxonomy_lists(bundle_path=bundle_path)
    if got is None:
        return {k: list(v) for k, v in _FALLBACK_LISTS.items()}
    return got


def language_reference_payload_taxonomy_slice(payload: Dict[str, Any]) -> Dict[str, List[str]]:
    """Extract the six TORQA-backed keys from a payload (for tests)."""
    return {k: list(payload[k]) for k in _KEYS_IN_ORDER}

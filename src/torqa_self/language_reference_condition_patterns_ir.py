"""
``language_reference_payload.condition_id_patterns`` — ordered dict from TORQA slug sequence.

Source: ``examples/torqa_self/language_reference_condition_patterns.tq`` → committed bundle.
TORQA carries slug order; JSON keys and pattern strings are bridged in ``_ENTRY_BY_SLUG``.
Which IR section uses which id prefix (execution) stays in verifiers — this is reference text only.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional, Tuple

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "language_reference_condition_patterns_bundle.json"

_CORE_INPUTS = 3
_SLUG_COUNT = 4

_SLUG_ORDER: tuple[str, ...] = (
    "condpat_preconditions",
    "condpat_forbids",
    "condpat_postconditions",
    "condpat_transitions",
)
_ALLOWED_SLUGS = frozenset(_SLUG_ORDER)

# slug -> (json_key, pattern prose)
_ENTRY_BY_SLUG: Dict[str, Tuple[str, str]] = {
    "condpat_preconditions": ("preconditions", "c_req_NNNN (four digits, unique)"),
    "condpat_forbids": ("forbids", "c_forbid_NNNN"),
    "condpat_postconditions": ("postconditions", "c_post_NNNN"),
    "condpat_transitions": ("transitions", "t_NNNN"),
}


def _fallback_ordered_dict() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for s in _SLUG_ORDER:
        k, v = _ENTRY_BY_SLUG[s]
        out[k] = v
    return out


def condition_id_patterns_dict(*, bundle_path: Optional[Path] = None) -> Optional[Dict[str, str]]:
    """Return ordered pattern dict from bundle, or ``None`` if invalid."""
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return None
    names = ir_goal_input_names(ig)
    need = _CORE_INPUTS + _SLUG_COUNT
    if len(names) < need:
        return None
    slugs = names[_CORE_INPUTS:need]
    if len(slugs) != _SLUG_COUNT or frozenset(slugs) != _ALLOWED_SLUGS:
        return None
    out: Dict[str, str] = {}
    for s in slugs:
        entry = _ENTRY_BY_SLUG.get(s)
        if entry is None:
            return None
        k, v = entry
        out[k] = v
    return out


def condition_id_patterns_with_fallback(*, bundle_path: Optional[Path] = None) -> Dict[str, str]:
    got = condition_id_patterns_dict(bundle_path=bundle_path)
    if got is None:
        return dict(_fallback_ordered_dict())
    return got

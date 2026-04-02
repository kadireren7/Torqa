"""
Ordered ``layered_authoring_passes`` strings for ``language_reference_payload`` / ``torqa language``.

Source: ``examples/torqa_self/layered_authoring_passes.tq`` → committed bundle.
TORQA carries slug order; human-readable lines are bridged here. Pass semantics stay in docs/Python callers.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "layered_authoring_passes_bundle.json"

_CORE_INPUTS = 3
_PASS_COUNT = 4

_SLUG_ORDER: tuple[str, ...] = (
    "layer_pass_skeleton",
    "layer_pass_preconditions",
    "layer_pass_transitions",
    "layer_pass_postconditions",
)

_LINE_BY_SLUG = {
    "layer_pass_skeleton": "A — skeleton (goal, inputs, metadata, empty arrays)",
    "layer_pass_preconditions": "B — preconditions / forbids",
    "layer_pass_transitions": (
        "C — transitions (void effects; σ must match from_state → to_state per AEM)"
    ),
    "layer_pass_postconditions": "D — postconditions; final full diagnostic",
}

_FALLBACK_LINES: List[str] = [_LINE_BY_SLUG[s] for s in _SLUG_ORDER]


def layered_authoring_passes_list(*, bundle_path: Optional[Path] = None) -> Optional[List[str]]:
    """Return four pass lines from bundle, or ``None`` if invalid."""
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return None
    names = ir_goal_input_names(ig)
    need = _CORE_INPUTS + _PASS_COUNT
    if len(names) < need:
        return None
    slugs = names[_CORE_INPUTS:need]
    if tuple(slugs) != _SLUG_ORDER:
        return None
    return [_LINE_BY_SLUG[s] for s in slugs]


def layered_authoring_passes_list_with_fallback(*, bundle_path: Optional[Path] = None) -> List[str]:
    got = layered_authoring_passes_list(bundle_path=bundle_path)
    if got is None:
        return list(_FALLBACK_LINES)
    return got

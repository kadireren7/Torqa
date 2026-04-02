"""
``diagnostics_issue_shape`` and ``aem_execution`` strings in ``language_reference_payload``.

Source: ``examples/torqa_self/language_reference_prose_refs.tq`` → committed bundle.
TORQA records the two reference slugs (order in ``inputs`` may vary); Python maps slug → prose.
How issues are built or how AEM halts are chosen stays in diagnostics/executors — this is human-facing reference text only.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "language_reference_prose_refs_bundle.json"

_CORE_INPUTS = 3
_REF_COUNT = 2

_SLUG_DIAG = "ref_diag_issue_shape"
_SLUG_AEM = "ref_aem_execution"
_ALLOWED_SLUGS = frozenset({_SLUG_DIAG, _SLUG_AEM})

_PAYLOAD_KEY_BY_SLUG = {
    _SLUG_DIAG: "diagnostics_issue_shape",
    _SLUG_AEM: "aem_execution",
}

_LINE_BY_SLUG = {
    _SLUG_DIAG: (
        "Each issue includes legacy phase plus formal_phase (FORMAL_CORE §2); "
        "repair loops should group by formal_phase."
    ),
    _SLUG_AEM: (
        "Reference Python and Rust executors enforce control state σ (before|after) and AEM_* halt codes; "
        "see docs/AEM_SPEC.md."
    ),
}

_FALLBACK_PROSE_REFS: Dict[str, str] = {
    "diagnostics_issue_shape": _LINE_BY_SLUG[_SLUG_DIAG],
    "aem_execution": _LINE_BY_SLUG[_SLUG_AEM],
}


def language_reference_prose_refs_dict(*, bundle_path: Optional[Path] = None) -> Optional[Dict[str, str]]:
    """Return ``{diagnostics_issue_shape: ..., aem_execution: ...}`` or ``None`` if invalid."""
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return None
    names = ir_goal_input_names(ig)
    need = _CORE_INPUTS + _REF_COUNT
    if len(names) < need:
        return None
    slugs = names[_CORE_INPUTS:need]
    if len(slugs) != _REF_COUNT or frozenset(slugs) != _ALLOWED_SLUGS:
        return None
    out: Dict[str, str] = {}
    for s in slugs:
        pk = _PAYLOAD_KEY_BY_SLUG.get(s)
        line = _LINE_BY_SLUG.get(s)
        if pk is None or line is None:
            return None
        out[pk] = line
    return out


def language_reference_prose_refs_with_fallback(*, bundle_path: Optional[Path] = None) -> Dict[str, str]:
    got = language_reference_prose_refs_dict(bundle_path=bundle_path)
    if got is None:
        return dict(_FALLBACK_PROSE_REFS)
    return got

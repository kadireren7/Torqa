"""
Behavior policy for ``suggested_next``: merge list cap + human CLI display cap (P15 / P15.1).

Source: ``examples/torqa_self/cli_suggested_next_merge_cap.tq`` → committed bundle.
Inputs after ``username`` / ``password`` / ``ip_address``:
  index 3 — ``sn_merge_cap_*`` → max items in merged lists (CLI JSON, web, project).
  index 4 — ``sn_display_cap_*`` → max lines under stderr "Next:" for some human-mode paths.

Which hint strings are chosen stays elsewhere; these knobs only bound counts / presentation.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "cli_suggested_next_merge_cap_bundle.json"

_CORE_INPUTS = 3
_MERGE_SLUG_INDEX = _CORE_INPUTS
_DISPLAY_SLUG_INDEX = _CORE_INPUTS + 1

_DEFAULT_MERGE_CAP = 10
_DEFAULT_DISPLAY_CAP = 6

_MERGE_CAP_BY_SLUG = {
    "sn_merge_cap_6": 6,
    "sn_merge_cap_8": 8,
    "sn_merge_cap_10": 10,
    "sn_merge_cap_12": 12,
}

_DISPLAY_CAP_BY_SLUG = {
    "sn_display_cap_4": 4,
    "sn_display_cap_6": 6,
    "sn_display_cap_8": 8,
}


def suggested_next_merge_cap(*, bundle_path: Optional[Path] = None) -> int:
    """
    Return max items for merged ``suggested_next`` lists.

    If the bundle is missing or the merge slug is unknown, return ``_DEFAULT_MERGE_CAP`` (10).
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return _DEFAULT_MERGE_CAP
    names = ir_goal_input_names(ig)
    if len(names) <= _MERGE_SLUG_INDEX:
        return _DEFAULT_MERGE_CAP
    slug = names[_MERGE_SLUG_INDEX]
    cap = _MERGE_CAP_BY_SLUG.get(slug)
    if cap is None:
        return _DEFAULT_MERGE_CAP
    return cap


def suggested_next_display_cap(*, bundle_path: Optional[Path] = None) -> int:
    """
    Return max lines shown for human stderr \"Next:\" hints (e.g. ``cmd_surface`` .tq parse errors).

    If the bundle is missing or the display slug is unknown, return ``_DEFAULT_DISPLAY_CAP`` (6).
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return _DEFAULT_DISPLAY_CAP
    names = ir_goal_input_names(ig)
    if len(names) <= _DISPLAY_SLUG_INDEX:
        return _DEFAULT_DISPLAY_CAP
    slug = names[_DISPLAY_SLUG_INDEX]
    cap = _DISPLAY_CAP_BY_SLUG.get(slug)
    if cap is None:
        return _DEFAULT_DISPLAY_CAP
    return cap

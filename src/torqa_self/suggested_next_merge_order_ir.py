"""
P16 / P16.1: Merge block order + secondary order among report-driven ``suggested_next`` lines.

Source: ``examples/torqa_self/cli_suggested_next_merge_order.tq`` → committed bundle.
Which lines qualify is decided in Python; TORQA only selects ordering policy.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal, Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "cli_suggested_next_merge_order_bundle.json"

_CORE_INPUTS = 3
_ORDER_SLUG_INDEX = _CORE_INPUTS
_SECONDARY_SLUG_INDEX = _CORE_INPUTS + 1

ReportSecondaryOrder = Literal["scan", "surface_before_sem"]


def suggested_next_merge_onboarding_first(*, bundle_path: Optional[Path] = None) -> bool:
    """
    If True, merge as ``onboarding_prefix + rest`` (historical behavior).
    If False, merge as ``rest + onboarding_prefix`` (context-first).

    Unknown or missing slug → True (fallback).
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return True
    names = ir_goal_input_names(ig)
    if len(names) <= _ORDER_SLUG_INDEX:
        return True
    slug = names[_ORDER_SLUG_INDEX]
    if slug == "sn_merge_order_context_first":
        return False
    if slug == "sn_merge_order_onboarding_first":
        return True
    return True


def suggested_next_report_secondary_order(
    *, bundle_path: Optional[Path] = None
) -> ReportSecondaryOrder:
    """
    How to order selected report hint lines before merging with onboarding.

    ``scan`` — keep order from ``cli_report_suggested_next_order`` slug scan (legacy).
    ``surface_before_sem`` — if both sem and surface lines are present and sem precedes
    surface, move the surface line to immediately before the sem line.
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return "scan"
    names = ir_goal_input_names(ig)
    if len(names) <= _SECONDARY_SLUG_INDEX:
        return "scan"
    slug = names[_SECONDARY_SLUG_INDEX]
    if slug == "sn_secondary_report_order_surface_first":
        return "surface_before_sem"
    if slug == "sn_secondary_report_order_scan":
        return "scan"
    return "scan"

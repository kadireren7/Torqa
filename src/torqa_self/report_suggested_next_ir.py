"""
Order of report-driven CLI ``suggested_next`` lines (before merge with onboarding prefix).

Source: ``examples/torqa_self/cli_report_suggested_next_order.tq`` → committed
``examples/torqa_self/cli_report_suggested_next_order_bundle.json`` (do not re-sort ``inputs``).

Which issue codes select each line stays in Python (``user_hints.suggested_next_from_report``).
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "cli_report_suggested_next_order_bundle.json"

# Keys must match ``report_next_*`` slugs in the .tq / bundle (order from bundle).
REPORT_NEXT_LINE_BY_SLUG: Dict[str, str] = {
    "report_next_sem": "torqa language  # list builtins, effects, and rules",
    "report_next_minimal_json": "torqa language --minimal-json",
    "report_next_surface": "torqa surface FILE.tq  # after fixing .tq syntax",
    "report_next_validate": "torqa validate bundle.json  # after edits",
}

_FALLBACK_SLUG_ORDER = (
    "report_next_sem",
    "report_next_minimal_json",
    "report_next_surface",
    "report_next_validate",
)


def load_report_next_slug_order(*, bundle_path: Path | None = None) -> List[str]:
    """
    Return ``report_next_*`` slug names in bundle ``inputs`` order.

    If the bundle is missing or invalid, use ``_FALLBACK_SLUG_ORDER``.
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return list(_FALLBACK_SLUG_ORDER)

    out: List[str] = []
    for name in ir_goal_input_names(ig):
        if not name.startswith("report_next_"):
            continue
        if name in REPORT_NEXT_LINE_BY_SLUG:
            out.append(name)

    if len(out) != len(_FALLBACK_SLUG_ORDER):
        return list(_FALLBACK_SLUG_ORDER)
    return out

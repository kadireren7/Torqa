"""
CLI onboarding prefix: structure and slug order from TORQA IR; display strings bridged in Python.

Source: ``examples/torqa_self/cli_onboarding.tq`` → committed
``examples/torqa_self/cli_onboarding_bundle.json`` (do not re-sort ``inputs``).
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "cli_onboarding_bundle.json"

ONBOARDING_STARTER_TQ = "examples/workspace_minimal/app.tq"

# Keys must match ``onboarding_*`` slugs in cli_onboarding.tq / bundle inputs (order from bundle).
_LINE_BY_ONBOARDING_SLUG = {
    "onboarding_try_build": f"Try: torqa build {ONBOARDING_STARTER_TQ}",
    "onboarding_starter_line": f"Starter: {ONBOARDING_STARTER_TQ}",
    "onboarding_templates_line": "Templates: examples/torqa/templates/ (minimal.tq, login_flow.tq)",
}

_FALLBACK_ORDER = (
    "onboarding_try_build",
    "onboarding_starter_line",
    "onboarding_templates_line",
)

# Backwards-compatible names (re-export for callers that imported from user_hints).
ONBOARDING_TRY_BUILD = _LINE_BY_ONBOARDING_SLUG["onboarding_try_build"]
ONBOARDING_STARTER_LINE = _LINE_BY_ONBOARDING_SLUG["onboarding_starter_line"]
ONBOARDING_TEMPLATES_LINE = _LINE_BY_ONBOARDING_SLUG["onboarding_templates_line"]


def load_onboarding_suggested_next_prefix(*, bundle_path: Path | None = None) -> List[str]:
    """
    Return the three default CLI onboarding lines, ordered as in the TORQA bundle.

    If the bundle is missing (e.g. non-editable install), use ``_FALLBACK_ORDER``.
    """
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return [_LINE_BY_ONBOARDING_SLUG[k] for k in _FALLBACK_ORDER]

    out: List[str] = []
    for name in ir_goal_input_names(ig):
        if not name.startswith("onboarding_"):
            continue
        line = _LINE_BY_ONBOARDING_SLUG.get(name)
        if line is not None:
            out.append(line)

    if len(out) != len(_FALLBACK_ORDER):
        return [_LINE_BY_ONBOARDING_SLUG[k] for k in _FALLBACK_ORDER]
    return out

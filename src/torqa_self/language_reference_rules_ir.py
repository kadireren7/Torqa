"""
All seven ``language_reference_payload.rules`` lines (P13.2: fully TORQA-ordered policy prose).

Source: ``examples/torqa_self/language_reference_rules_prefix.tq`` → committed bundle.
TORQA carries slug order; full sentences are bridged in ``_LINE_BY_SLUG``.
Invalid/missing bundle → ``_FALLBACK_PREFIX`` (canonical seven-line order).

Interpretation of rules (when to apply, how tooling consumes them) stays in docs and callers — not in IR.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from src.torqa_self.bundle_io import ir_goal_input_names, load_bundle_ir_goal, repo_root

_REPO_ROOT = repo_root()
_DEFAULT_BUNDLE = _REPO_ROOT / "examples" / "torqa_self" / "language_reference_rules_prefix_bundle.json"

_CORE_INPUTS = 3
_PREFIX_COUNT = 7

# Canonical order for fallback only; committed bundle order may permute these seven slugs.
_SLUG_ORDER: tuple[str, ...] = (
    "policy_rule_profile",
    "policy_rule_output_shape",
    "policy_rule_builtins",
    "policy_rule_unique_ids",
    "policy_rule_aem_chain",
    "policy_rule_diagnostics_full",
    "policy_rule_multi_surface",
)
_ALLOWED_SLUGS = frozenset(_SLUG_ORDER)

_LINE_BY_SLUG = {
    "policy_rule_profile": (
        "See docs/AI_GENERATION_PROFILE.md and docs/SELF_EVOLUTION_PIPELINE.md: "
        "validate-then-expand, minimal diff on repair, proposal-gate before merge."
    ),
    "policy_rule_output_shape": (
        "Output exactly one JSON object with top-level key ir_goal "
        "(and optional envelope keys only as in schema)."
    ),
    "policy_rule_builtins": (
        "Use only listed builtins by name; match arity. Predicates in conditions; "
        "void builtins as transition effect_name only."
    ),
    "policy_rule_unique_ids": (
        "Every condition_id and transition_id must be globally unique within ir_goal."
    ),
    "policy_rule_aem_chain": (
        "Chained transitions: after the first before→after step, later transitions must use "
        'from_state "after" when σ is already after (AEM).'
    ),
    "policy_rule_diagnostics_full": (
        "Passing full diagnostics requires structural + handoff + determinism + semantic checks "
        "(no verifier bypass)."
    ),
    "policy_rule_multi_surface": (
        "Multi-surface: valid IR is not website-only — orchestration emits generated/webapp (Vite) "
        "plus stubs such as generated/sql/schema.sql, generated/rust/main.rs, generated/python/main.py; "
        "logging-like effects raise SQL relevance."
    ),
}

_FALLBACK_PREFIX: List[str] = [_LINE_BY_SLUG[s] for s in _SLUG_ORDER]


def language_reference_rules_prefix(*, bundle_path: Optional[Path] = None) -> Optional[List[str]]:
    """Return seven policy lines from bundle, or ``None`` if invalid."""
    p = bundle_path or _DEFAULT_BUNDLE
    ig = load_bundle_ir_goal(p)
    if not ig:
        return None
    names = ir_goal_input_names(ig)
    need = _CORE_INPUTS + _PREFIX_COUNT
    if len(names) < need:
        return None
    slugs = names[_CORE_INPUTS:need]
    if len(slugs) != _PREFIX_COUNT or frozenset(slugs) != _ALLOWED_SLUGS:
        return None
    out: List[str] = []
    for s in slugs:
        line = _LINE_BY_SLUG.get(s)
        if line is None:
            return None
        out.append(line)
    return out


def language_reference_rules_prefix_with_fallback(*, bundle_path: Optional[Path] = None) -> List[str]:
    got = language_reference_rules_prefix(bundle_path=bundle_path)
    if got is None:
        return list(_FALLBACK_PREFIX)
    return got


def language_reference_rules_list_with_fallback(*, rules_prefix_bundle: Optional[Path] = None) -> List[str]:
    """Full ``rules`` list for ``language_reference_payload`` (same as prefix; no Python suffix)."""
    return language_reference_rules_prefix_with_fallback(bundle_path=rules_prefix_bundle)

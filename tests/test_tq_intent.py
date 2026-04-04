"""P83: deterministic .tq generation intent + prompt normalization."""

from __future__ import annotations

from src.ai.tq_intent import (
    classify_tq_gen_intent,
    normalize_prompt_text,
    profile_rules_markdown,
    resolve_tq_gen_intent,
)


def test_normalize_prompt_collapses_blank_runs():
    assert normalize_prompt_text("  a\n\n\nb  ") == "a\n\nb"


def test_classify_auth_before_landing():
    assert classify_tq_gen_intent("Landing page with sign-in and password field") == "auth"


def test_classify_landing():
    assert classify_tq_gen_intent("Marketing landing with hero and waitlist email") == "landing"


def test_classify_crud_from_dashboard_wording():
    assert classify_tq_gen_intent("Admin dashboard with KPI row and sidebar") == "crud"


def test_classify_automation():
    assert classify_tq_gen_intent("Approval workflow with webhook trigger") == "automation"


def test_classify_generic():
    assert classify_tq_gen_intent("do something useful") == "generic"


def test_resolve_forced_category_overrides_text():
    assert resolve_tq_gen_intent("waitlist and hero section", "crud") == "crud"
    assert resolve_tq_gen_intent("do something useful", "landing") == "landing"


def test_profile_rules_non_empty():
    from typing import cast

    from src.ai.tq_intent import TqGenIntent

    for k in cast(tuple[TqGenIntent, ...], ("auth", "landing", "crud", "automation", "generic")):
        assert "requires" in profile_rules_markdown(k)

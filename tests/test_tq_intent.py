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


def test_classify_dashboard_from_kpi_wording():
    assert classify_tq_gen_intent("Admin dashboard with KPI row and sidebar") == "dashboard"


def test_classify_approvals_workflow():
    assert classify_tq_gen_intent("Approval workflow with webhook trigger") == "approvals"


def test_classify_automation_without_approval_phrase():
    assert classify_tq_gen_intent("Webhook trigger that enqueues a background job") == "automation"


def test_classify_crm():
    assert classify_tq_gen_intent("Salesforce-style CRM pipeline for deals and account owners") == "crm"


def test_classify_onboarding():
    assert classify_tq_gen_intent("SaaS onboarding wizard: welcome, profile, then billing step") == "onboarding"


def test_resolve_forced_crm():
    assert resolve_tq_gen_intent("waitlist and hero section", "crm") == "crm"


def test_classify_generic():
    assert classify_tq_gen_intent("do something useful") == "generic"


def test_resolve_forced_category_overrides_text():
    assert resolve_tq_gen_intent("waitlist and hero section", "crud") == "crud"
    assert resolve_tq_gen_intent("do something useful", "landing") == "landing"


def test_profile_rules_non_empty():
    from typing import cast

    from src.ai.tq_intent import TqGenIntent

    for k in cast(
        tuple[TqGenIntent, ...],
        (
            "auth",
            "landing",
            "crud",
            "automation",
            "crm",
            "onboarding",
            "approvals",
            "dashboard",
            "generic",
        ),
    ):
        assert "requires" in profile_rules_markdown(k)

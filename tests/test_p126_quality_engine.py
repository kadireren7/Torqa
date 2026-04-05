"""P126: structured quality dimensions, domain-aware hard rules, placeholder/stub detection."""

from __future__ import annotations

from pathlib import Path

from src.ai.tq_quality_gate import (
    TqQualityResult,
    evaluate_tq_quality,
    format_quality_refinement_message,
)

_DIM_KEYS = frozenset(
    {
        "layout_completeness",
        "content_completeness",
        "component_completeness",
        "navigation_section_structure",
        "app_workflow_coherence",
        "placeholder_stub_hygiene",
    }
)


def test_p126_dimensions_always_present_when_enabled(tmp_path: Path) -> None:
    pad = "# " + "x" * 95 + "\n"
    tq = (
        pad
        + "# second section line for landing shape\n"
        + "module g.x\n\nintent ok_flow\nrequires email, password\nresult LeadCaptured\n\nflow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="landing", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert set(r.dimensions.keys()) == _DIM_KEYS
    assert all(0 <= v <= 100 for v in r.dimensions.values())


def test_p126_placeholder_tokens_hard_fail(tmp_path: Path) -> None:
    tq = (
        "# hero\n"
        "# proof\n"
        "module g.marketing\n\n"
        "intent capture_lead\n"
        "requires email, password\n"
        "result LeadCaptured\n\n"
        "flow:\n"
        "  # lorem ipsum filler comment inside flow block\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="landing", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations
    assert any("placeholder" in v.lower() or "lorem" in v.lower() for v in r.hard_violations)
    assert r.dimensions.get("placeholder_stub_hygiene") == 0


def test_p126_marketing_domain_requires_two_section_comments(tmp_path: Path) -> None:
    tq = (
        "# single section only\n"
        "module g.site\n\n"
        "intent landing_main\n"
        "requires email, name, password\n"
        "result SignupComplete\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(
        tq,
        intent_kind="landing",
        synthetic_path=tmp_path / "s.tq",
        enabled=True,
        product_domain="marketing_site",
    )
    assert not r.passed
    assert any("marketing" in v.lower() for v in r.hard_violations)


def test_p126_rich_automation_prompt_rejects_trivial_spec(tmp_path: Path) -> None:
    prompt = (
        "Webhook triggered worker with queue retries, branching stages, parallel transforms, "
        "dead letter routing, and orchestration across sinks"
    )
    tq = (
        "# stage a\n"
        "# stage b\n"
        "module g.worker\n\n"
        "intent sync_job\n"
        "requires run_id, password\n"
        "result JobAccepted\n\n"
        "flow:\n"
        "  create session\n"
    )
    r = evaluate_tq_quality(
        tq,
        intent_kind="automation",
        synthetic_path=tmp_path / "s.tq",
        enabled=True,
        product_domain="automation_system",
        user_prompt=prompt,
    )
    assert not r.passed
    assert any("automation" in v.lower() and "trivial" in v.lower() for v in r.hard_violations)


def test_p126_refinement_message_lists_dimensions() -> None:
    dims = {k: 40 for k in _DIM_KEYS}
    q = TqQualityResult(
        passed=False,
        score=30,
        hard_violations=["Fix structure"],
        soft_reasons=["Raise score"],
        dimensions=dims,
    )
    msg = format_quality_refinement_message(q, intent_kind="dashboard")
    assert "P126" in msg
    assert "pass 2" in msg.lower() and "pass 3" in msg.lower()
    assert "layout_completeness" in msg
    assert "Quality dimensions" in msg


def test_p126_weak_aggregate_with_good_score_still_fails_on_dimension_floor(tmp_path: Path) -> None:
    """Thin but syntactically valid specs must not pass when an axis stays very low (P126)."""
    tq = (
        "# a\n"
        "# b\n"
        "module g.shell\n\n"
        "intent thin_surface\n"
        "requires x, password\n"
        "result OK\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="generic", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations or r.soft_reasons

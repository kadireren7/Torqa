"""P115 / P122: heuristic quality gate for generated .tq (post-validation)."""

from __future__ import annotations

from pathlib import Path

from src.ai.tq_quality_gate import evaluate_tq_quality, format_quality_refinement_message

REPO = Path(__file__).resolve().parents[1]


def test_quality_accepts_flagship_baseline(tmp_path: Path) -> None:
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    r = evaluate_tq_quality(text, intent_kind="auth", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert r.passed, (r.hard_violations, r.soft_reasons, r.score)
    assert r.score >= 50


def test_quality_rejects_file_too_short(tmp_path: Path) -> None:
    r = evaluate_tq_quality("intent x\nrequires a, password\nresult OK\n\nflow:\n", intent_kind="generic", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations


def test_quality_generic_empty_flow_and_trivial_result_hard_fail(tmp_path: Path) -> None:
    tq = (
        "module g.demo\n\n"
        "intent idle_flow\n"
        "requires username, password\n"
        "result OK\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="generic", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations


def test_quality_crud_requires_three_inputs(tmp_path: Path) -> None:
    tq = (
        "# enough length and comments to pass soft score if hard were absent\n"
        "# second comment line\n"
        "module g.crud\n\n"
        "intent two_field\n"
        "requires username, password\n"
        "result SomethingMeaningful\n\n"
        "flow:\n"
        "  create session\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="crud", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert any("three" in v.lower() or "3" in v for v in r.hard_violations)


def test_quality_disabled_skips_checks(tmp_path: Path) -> None:
    r = evaluate_tq_quality("tiny", intent_kind="crud", synthetic_path=tmp_path / "s.tq", enabled=False)
    assert r.passed and r.score == 100


def test_quality_dashboard_requires_four_inputs(tmp_path: Path) -> None:
    tq = (
        "# dashboard zone a\n"
        "# dashboard zone b\n"
        "module g.dash\n\n"
        "intent kpi_board\n"
        "requires report_id, metric_key, password\n"
        "result DashboardLoaded\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="dashboard", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert any("four" in v.lower() or "4" in v for v in r.hard_violations)


def test_quality_approvals_requires_flow_step(tmp_path: Path) -> None:
    tq = (
        "# approval request context\n"
        "# policy and routing\n"
        "module g.appr\n\n"
        "intent po_approval\n"
        "requires request_id, approver_id, policy_tier, amount_cents, password\n"
        "result PendingReview\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="approvals", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert any("flow" in v.lower() for v in r.hard_violations)


def test_format_refinement_non_empty() -> None:
    from src.ai.tq_quality_gate import TqQualityResult

    q = TqQualityResult(passed=False, score=12, hard_violations=["do better"], soft_reasons=["add module"])
    msg = format_quality_refinement_message(q, intent_kind="crud")
    assert "P126" in msg
    assert "do better" in msg
    assert "brevity" in msg.lower() or "token" in msg.lower()


def test_quality_landing_rejects_bare_single_field(tmp_path: Path) -> None:
    tq = (
        "module generated.marketing_landing\n\n"
        "intent capture_waitlist_signup_intent\n"
        "requires email, password\n"
        "result LeadCaptured\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="landing", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations
    assert any("Landing" in v or "marketing" in v.lower() for v in r.hard_violations)


def test_quality_landing_accepts_commented_single_field(tmp_path: Path) -> None:
    tq = (
        "# Hero: headline and primary email capture\n"
        "# Social proof strip and secondary CTA zone\n"
        "module generated.marketing_landing\n\n"
        "intent waitlist_landing\n"
        "requires email, password\n"
        "result LeadCaptured\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="landing", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert r.passed, (r.hard_violations, r.soft_reasons, r.score)


def test_quality_crm_requires_two_section_comments(tmp_path: Path) -> None:
    tq = (
        "module g.crm\n\n"
        "intent deal_pipeline_view\n"
        "requires account_id, deal_id, owner_id, stage_code, password\n"
        "result PipelineReady\n\n"
        "flow:\n"
        "  create session\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="crm", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert any("CRM" in v for v in r.hard_violations)


def test_quality_generic_rejects_thin_two_field_shell(tmp_path: Path) -> None:
    tq = (
        "module generated.application_main_shell\n\n"
        "intent primary_workspace_screen_placeholder\n"
        "requires title, body, password\n"
        "result ScreenLoaded\n\n"
        "flow:\n"
    )
    r = evaluate_tq_quality(tq, intent_kind="generic", synthetic_path=tmp_path / "s.tq", enabled=True)
    assert not r.passed
    assert r.hard_violations
    assert any(
        "stub" in v.lower() or "empty" in v.lower() or "structure" in v.lower() for v in r.hard_violations
    )

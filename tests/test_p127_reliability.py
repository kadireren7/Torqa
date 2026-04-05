"""P127: validation chain, failure taxonomy, reliability summary, failure-aware nudges."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from src.diagnostics.codes import PX_AI_JSON
from src.ai.tq_reliability import (
    PIPELINE_STAGE_IDS,
    compute_reliability_summary,
    failure_aware_repair_nudge,
    projection_validation_effective,
    run_tq_validation_chain,
    validate_ir_projections,
)
from src.ai.tq_adapter import validate_tq_text
from src.ir.canonical_ir import ir_goal_from_json
from src.surface.parse_tq import parse_tq_source


REPO = Path(__file__).resolve().parents[1]


def test_run_tq_validation_chain_parse_failure(tmp_path: Path) -> None:
    r = run_tq_validation_chain("not torqa\n", synthetic_path=tmp_path / "x.tq")
    assert not r.ok
    assert r.failure_kind == "invalid_torqa_syntax"
    assert r.stage_reached == "parse_validation"


def test_run_tq_validation_chain_flagship_ok(tmp_path: Path) -> None:
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    r = run_tq_validation_chain(text, synthetic_path=tmp_path / "f.tq")
    assert r.ok
    assert r.failure_kind is None
    assert r.goal is not None
    assert r.stage_reached == "projection_validation"


def test_validate_tq_text_delegates_to_chain(tmp_path: Path) -> None:
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    ok, diag, err = validate_tq_text(text, synthetic_path=tmp_path / "v.tq")
    assert ok and diag and not err


def test_projection_validation_can_be_skipped_via_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("TORQA_SKIP_PROJECTION_VALIDATION", "1")
    assert projection_validation_effective() is False
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    r = run_tq_validation_chain(text, synthetic_path=tmp_path / "p.tq")
    assert r.ok
    assert r.stage_reached == "semantic_validation"


def test_poor_projection_failure_kind_when_emit_raises(tmp_path: Path) -> None:
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    with patch("src.ai.tq_reliability.validate_ir_projections", return_value=(False, "Boom")):
        r = run_tq_validation_chain(text, synthetic_path=tmp_path / "z.tq", run_projection=True)
    assert not r.ok
    assert r.failure_kind == "poor_projection"
    assert "Boom" in r.error_message


def test_failure_aware_nudge_covers_taxonomy() -> None:
    for kind in (
        "prompt_misunderstanding",
        "invalid_torqa_syntax",
        "semantic_invalidity",
        "poor_projection",
        "low_quality",
    ):
        assert failure_aware_repair_nudge(kind)


def test_compute_reliability_first_pass_vs_repaired() -> None:
    attempts_ok_first = [{"attempt": 0, "status": "ok"}]
    s1 = compute_reliability_summary(attempts_ok_first, ok=True)
    assert s1["first_pass_success"] is True
    assert s1["repaired_success"] is False
    assert s1["rates"]["first_pass_success"] == 1.0

    attempts_repaired = [
        {"attempt": 0, "failure_kind": "invalid_torqa_syntax"},
        {"attempt": 1, "status": "ok"},
    ]
    s2 = compute_reliability_summary(attempts_repaired, ok=True)
    assert s2["first_pass_success"] is False
    assert s2["repaired_success"] is True
    assert s2["rates"]["repaired_success"] == 1.0

    s3 = compute_reliability_summary(attempts_repaired[:-1], ok=False)
    assert s3["unrecoverable_failure"] is True
    assert s3["rates"]["unrecoverable_failure"] == 1.0


def test_pipeline_stage_ids_include_p127_stages() -> None:
    assert "prompt_interpretation" in PIPELINE_STAGE_IDS
    assert "projection_validation" in PIPELINE_STAGE_IDS
    assert "quality_validation" in PIPELINE_STAGE_IDS


def test_autofix_then_chain_recovers_requires_spacing(tmp_path: Path) -> None:
    from src.ai.tq_autofix import autofix_tq_surface

    raw = (
        "module g.fix\n\nintent demo\nrequires username password\nresult OK\n\nflow:\n"
    )
    fixed, fixes = autofix_tq_surface(raw)
    assert fixes
    r = run_tq_validation_chain(fixed, synthetic_path=tmp_path / "a.tq", run_projection=False)
    assert r.ok, (r.error_message, r.failure_kind)


@patch("src.ai.tq_adapter.resolve_llm_api_key", return_value="test-key")
def test_p127_empty_prompt_returns_json_code_and_reliability(_mock_key: object, tmp_path: Path) -> None:
    from src.ai.tq_adapter import _suggest_tq_one_provider

    out = _suggest_tq_one_provider(
        "   ",
        workspace_root=tmp_path,
        max_retries=1,
        model="gpt-4o-mini",
        gen_category=None,
        llm_provider="openai",
    )
    assert out["ok"] is False
    assert out["code"] == PX_AI_JSON
    assert "reliability" in out
    assert out["reliability"]["unrecoverable_failure"] is True


def test_validate_ir_projections_runs_all_targets(tmp_path: Path) -> None:
    text = (REPO / "examples" / "benchmark_flagship" / "app.tq").read_text(encoding="utf-8")
    bundle = parse_tq_source(text, tq_path=tmp_path / "b.tq")
    goal = ir_goal_from_json(bundle)
    ok, msg = validate_ir_projections(goal)
    assert ok and not msg

"""P113: structured plan, autofix, model hints (no live API)."""

from __future__ import annotations

from src.ai.tq_adapter import _format_validation_feedback, validate_tq_text
from src.ai.tq_autofix import autofix_tq_surface
from src.ai.tq_gen_model import classify_tq_model_route, get_tq_gen_model_hints, json_object_supported
from src.ai.tq_structured_plan import build_structured_generation_plan, format_structured_plan_block


def test_autofix_intent_hyphens_requires_comma_flow_blanks():
    raw = (
        "module x\n\nintent foo-bar\nrequires username password\nresult OK\n\nflow:\n"
        "  create session\n\n  emit login_success\n"
    )
    fixed, fixes = autofix_tq_surface(raw)
    assert "intent foo_bar" in fixed
    assert "requires username, password" in fixed
    assert fixes
    assert "flow_remove_blank_lines" in fixes


def test_structured_plan_has_contract_and_hints():
    plan = build_structured_generation_plan("Sign in with password", "auth", "app")
    assert plan["generation_profile"] == "auth"
    assert plan["surface_kind"] == "app"
    assert "intent_snake_case" in plan
    assert plan["output_contract"]["json_top_level_keys"] == ["tq"]
    block = format_structured_plan_block(plan)
    assert "Structured plan" in block
    assert "forbidden_top_level_keys" in block


def test_model_hints_routes():
    assert classify_tq_model_route("gpt-4o-mini") == "openai"
    assert classify_tq_model_route("claude-3-5-sonnet") == "anthropic"
    assert classify_tq_model_route("gemini-1.5-pro") == "google"
    h = get_tq_gen_model_hints("claude-3-opus")
    assert h.temperature_repair == 0.0
    assert "Claude" in h.system_suffix or "JSON" in h.system_suffix


def test_json_object_supported_openai_not_gemini():
    assert json_object_supported("gpt-4o") is True
    assert json_object_supported("gemini-pro") is False
    assert json_object_supported("o1-preview") is False


def test_format_validation_feedback_includes_issue_codes():
    fb = _format_validation_feedback(
        parse_or_shape_err=None,
        diagnostics={
            "issues": [
                {"code": "PX_TQ_FLOW_BLANK_LINE", "message": "blank line in flow"},
            ]
        },
        summary="top summary",
    )
    assert "PX_TQ_FLOW_BLANK_LINE" in fb
    assert "top summary" in fb


def test_validate_tq_after_autofix_minimal(tmp_path):
    raw = "intent a_b\nrequires username, password\nresult OK\nflow:\n  create session\n\n"
    fixed, _ = autofix_tq_surface(raw)
    ok, _diag, err = validate_tq_text(fixed, synthetic_path=tmp_path / "x.tq")
    assert ok, err

"""
tq_v1 syntax contract: canonical sources stay valid; legacy and silent-parse paths fail loudly.

Golden IR remains in test_tq_parser_golden.py; this module adds behavioral contracts only.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.surface.parse_tq import TQParseError, parse_tq_source

REPO = Path(__file__).resolve().parents[1]
TORQA = REPO / "examples" / "torqa"


def _parse(text: str):
    return parse_tq_source(text)


# --- 1) Canonical: diagnostics OK -------------------------------------------


@pytest.mark.parametrize(
    "tq_name",
    ["canonical_minimal.tq", "canonical_session_flow.tq", "canonical_view_login.tq"],
)
def test_canonical_tq_files_parse_and_diagnose_ok(tq_name: str) -> None:
    raw = (TORQA / tq_name).read_text(encoding="utf-8")
    bundle = _parse(raw)
    g = ir_goal_from_json(bundle)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep


# --- 2) Legacy flow syntax → error (not no-op) -------------------------------


@pytest.mark.parametrize(
    "step",
    [
        "validate username",
        "validate password",
        "find user by email",
        "find user by username",
        "find user by phone",
        "verify password",
    ],
)
def test_legacy_flow_step_rejected(step: str) -> None:
    src = f"""
intent x
requires username, password, ip_address
result OK
flow:
  {step}
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_LEGACY_FLOW_STEP"


# --- 3) Former silent-parse cases → explicit errors --------------------------


def test_flow_blank_line_between_steps_rejected() -> None:
    src = """
intent x
requires username, password, ip_address
result OK
flow:
  create session

  emit login_success
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_FLOW_BLANK_LINE"


def test_flow_triple_space_indent_rejected() -> None:
    src = """
intent x
requires username, password, ip_address
result OK
flow:
   create session
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_FLOW_INDENT"


def test_content_after_flow_block_rejected() -> None:
    src = """
intent x
requires username, password
result OK
flow:
trailing
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_CONTENT_AFTER_FLOW"


def test_wrong_case_flow_step_rejected() -> None:
    src = """
intent x
requires username, password, ip_address
result OK
flow:
  Create session
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_UNKNOWN_FLOW_STEP"


# --- 4) Required result + case-sensitive headers -----------------------------


def test_missing_result_before_flow_raises() -> None:
    src = """
intent x
requires username, password
flow:
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_MISSING_RESULT"


def test_uppercase_header_keyword_rejected() -> None:
    src = """
Intent x
requires username, password
result OK
flow:
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_UNRECOGNIZED_LINE"


def test_flow_keyword_must_be_lowercase() -> None:
    src = """
intent x
requires username, password
result OK
Flow:
"""
    with pytest.raises(TQParseError) as ei:
        _parse(src)
    assert ei.value.code == "PX_TQ_UNRECOGNIZED_LINE"

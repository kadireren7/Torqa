"""TORQA-authored order for report-driven suggested_next (examples/torqa_self → user_hints)."""

from __future__ import annotations

import json
from pathlib import Path

from src.diagnostics.user_hints import (
    ONBOARDING_STARTER_LINE,
    ONBOARDING_TRY_BUILD,
    ONBOARDING_TEMPLATES_LINE,
    suggested_next_from_report,
)
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.report_suggested_next_ir import (
    REPORT_NEXT_LINE_BY_SLUG,
    load_report_next_slug_order,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "cli_report_suggested_next_order_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "cli_report_suggested_next_order.tq"

_SEM = REPORT_NEXT_LINE_BY_SLUG["report_next_sem"]
_MIN = REPORT_NEXT_LINE_BY_SLUG["report_next_minimal_json"]
_SURF = REPORT_NEXT_LINE_BY_SLUG["report_next_surface"]
_VAL = REPORT_NEXT_LINE_BY_SLUG["report_next_validate"]


def _rep(*codes: str) -> dict:
    return {"issues": [{"code": c} for c in codes]}


def test_bundle_report_next_slug_order_stable():
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    names = [i["name"] for i in data["ir_goal"]["inputs"]]
    report = [n for n in names if str(n).startswith("report_next_")]
    assert report == [
        "report_next_sem",
        "report_next_minimal_json",
        "report_next_surface",
        "report_next_validate",
    ]


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_fallback_slug_order_when_bundle_missing(tmp_path):
    assert load_report_next_slug_order(bundle_path=tmp_path / "missing.json") == [
        "report_next_sem",
        "report_next_minimal_json",
        "report_next_surface",
        "report_next_validate",
    ]


def test_empty_issues_defaults_to_minimal_json_after_prefix():
    out = suggested_next_from_report(_rep())
    assert out[:3] == [
        ONBOARDING_TRY_BUILD,
        ONBOARDING_STARTER_LINE,
        ONBOARDING_TEMPLATES_LINE,
    ]
    assert _MIN in out
    assert out[3] == _MIN


def test_sem_code_appends_sem_line():
    out = suggested_next_from_report(_rep("PX_SEM_UNKNOWN_FUNCTION"))
    assert _SEM in out
    assert out.index(_SEM) == 3


def test_ir_metadata_appends_minimal():
    out = suggested_next_from_report(_rep("PX_IR_METADATA"))
    assert out[3] == _MIN


def test_tq_code_appends_surface():
    out = suggested_next_from_report(_rep("PX_TQ_FLOW_INDENT"))
    assert out[3] == _SURF


def test_handoff_appends_validate():
    out = suggested_next_from_report(_rep("PX_HANDOFF"))
    assert out[3] == _VAL


def test_sem_then_tq_follows_bundle_slug_order():
    out = suggested_next_from_report(_rep("PX_SEM_UNKNOWN_FUNCTION", "PX_TQ_FLOW_INDENT"))
    assert out[3] == _SEM
    assert out[4] == _SURF


def test_unknown_code_only_falls_back_to_minimal():
    out = suggested_next_from_report(_rep("PX_OTHER_UNKNOWN"))
    assert out[3] == _MIN


def test_reordered_bundle_changes_relative_line_order(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    base = list(ig["inputs"])
    head = [r for r in base if not str(r.get("name", "")).startswith("report_next_")]
    sem = next(r for r in base if r.get("name") == "report_next_sem")
    surf = next(r for r in base if r.get("name") == "report_next_surface")
    minimal = next(r for r in base if r.get("name") == "report_next_minimal_json")
    val = next(r for r in base if r.get("name") == "report_next_validate")
    ig["inputs"] = head + [surf, sem, minimal, val]
    alt = tmp_path / "reorder.json"
    alt.write_text(json.dumps(data, indent=2), encoding="utf-8")

    rep = _rep("PX_SEM_UNKNOWN_FUNCTION", "PX_TQ_FLOW_INDENT")
    default = suggested_next_from_report(rep)
    custom = suggested_next_from_report(rep, report_slug_order_bundle=alt)
    assert default[3] == _SEM and default[4] == _SURF
    assert custom[3] == _SURF and custom[4] == _SEM

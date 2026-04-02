"""TORQA-driven merge cap for suggested_next lists (P15)."""

from __future__ import annotations

import json
from pathlib import Path

from src.diagnostics.user_hints import merge_onboarding_suggested_next, suggested_next_from_report
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.suggested_next_merge_cap_ir import suggested_next_display_cap, suggested_next_merge_cap

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "cli_suggested_next_merge_cap_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "cli_suggested_next_merge_cap.tq"


def test_default_cap_is_ten():
    assert suggested_next_merge_cap() == 10


def test_default_display_cap_is_six():
    assert suggested_next_display_cap() == 6


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_fallback_unknown_slug_returns_ten(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_cap_10":
            row["name"] = "sn_merge_cap_unknown"
            break
    bad = tmp_path / "badslug.json"
    bad.write_text(json.dumps(data), encoding="utf-8")
    assert suggested_next_merge_cap(bundle_path=bad) == 10


def test_cap_six_truncates_merge(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_cap_10":
            row["name"] = "sn_merge_cap_6"
            break
    alt = tmp_path / "cap6.json"
    alt.write_text(json.dumps(data), encoding="utf-8")

    rest = [f"extra_{i}" for i in range(20)]
    out_default = merge_onboarding_suggested_next(rest)
    out_six = merge_onboarding_suggested_next(rest, merge_cap_bundle=alt)
    assert len(out_default) == 10
    assert len(out_six) == 6


def test_suggested_next_from_report_respects_merge_cap_bundle(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_cap_10":
            row["name"] = "sn_merge_cap_6"
            break
    alt = tmp_path / "cap6.json"
    alt.write_text(json.dumps(data), encoding="utf-8")

    rep = {
        "issues": [
            {"code": "PX_SEM_UNKNOWN_FUNCTION"},
            {"code": "PX_IR_METADATA"},
            {"code": "PX_TQ_FLOW_INDENT"},
            {"code": "PX_HANDOFF"},
        ]
    }
    full = suggested_next_from_report(rep)
    capped = suggested_next_from_report(rep, merge_cap_bundle=alt)
    assert len(full) > 6
    assert len(capped) == 6
    assert capped == full[:6]


def test_display_cap_four(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_display_cap_6":
            row["name"] = "sn_display_cap_4"
            break
    alt = tmp_path / "disp4.json"
    alt.write_text(json.dumps(data), encoding="utf-8")
    assert suggested_next_display_cap(bundle_path=alt) == 4
    assert suggested_next_merge_cap(bundle_path=alt) == 10

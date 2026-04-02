"""P16: TORQA-driven onboarding vs rest merge order for suggested_next."""

from __future__ import annotations

import json
from pathlib import Path

from src.diagnostics.user_hints import merge_onboarding_suggested_next, suggested_next_from_report
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.onboarding_ir import ONBOARDING_TRY_BUILD
from src.torqa_self.report_suggested_next_ir import REPORT_NEXT_LINE_BY_SLUG
from src.torqa_self.suggested_next_merge_order_ir import (
    suggested_next_merge_onboarding_first,
    suggested_next_report_secondary_order,
)
from src.torqa_self.surface_fail_hints_ir import load_surface_project_fail_suffix

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "cli_suggested_next_merge_order_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "cli_suggested_next_merge_order.tq"


def test_default_onboarding_first_is_true():
    assert suggested_next_merge_onboarding_first() is True


def test_default_secondary_order_is_scan():
    assert suggested_next_report_secondary_order() == "scan"


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_fallback_unknown_slug_onboarding_first(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_order_onboarding_first":
            row["name"] = "sn_merge_order_unknown"
            break
    bad = tmp_path / "badorder.json"
    bad.write_text(json.dumps(data), encoding="utf-8")
    assert suggested_next_merge_onboarding_first(bundle_path=bad) is True


def test_fallback_unknown_secondary_slug_is_scan(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_secondary_report_order_scan":
            row["name"] = "sn_secondary_report_order_unknown"
            break
    bad = tmp_path / "badsecondary.json"
    bad.write_text(json.dumps(data), encoding="utf-8")
    assert suggested_next_report_secondary_order(bundle_path=bad) == "scan"


def test_surface_before_sem_swaps_report_lines(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_secondary_report_order_scan":
            row["name"] = "sn_secondary_report_order_surface_first"
            break
    alt = tmp_path / "surfsem.json"
    alt.write_text(json.dumps(data), encoding="utf-8")

    rep = {"issues": [{"code": "PX_SEM_UNKNOWN_FUNCTION"}, {"code": "PX_TQ_FLOW_INDENT"}]}
    sem_line = REPORT_NEXT_LINE_BY_SLUG["report_next_sem"]
    surf_line = REPORT_NEXT_LINE_BY_SLUG["report_next_surface"]
    default = suggested_next_from_report(rep)
    custom = suggested_next_from_report(rep, merge_order_bundle=alt)
    assert default.index(sem_line) < default.index(surf_line)
    assert custom.index(surf_line) < custom.index(sem_line)


def test_context_first_reorders_before_onboarding(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_order_onboarding_first":
            row["name"] = "sn_merge_order_context_first"
            break
    alt = tmp_path / "ctxfirst.json"
    alt.write_text(json.dumps(data), encoding="utf-8")

    rest = load_surface_project_fail_suffix()
    onb_first = merge_onboarding_suggested_next(rest, merge_order_bundle=BUNDLE)
    ctx_first = merge_onboarding_suggested_next(rest, merge_order_bundle=alt)
    assert onb_first[0] == ONBOARDING_TRY_BUILD
    assert ctx_first[0] == rest[0]
    assert ctx_first[: len(rest)] == rest
    assert set(ctx_first) == set(onb_first)


def test_suggested_next_from_report_respects_merge_order_bundle(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    for row in ig["inputs"]:
        if row.get("name") == "sn_merge_order_onboarding_first":
            row["name"] = "sn_merge_order_context_first"
            break
    alt = tmp_path / "ctxfirst.json"
    alt.write_text(json.dumps(data), encoding="utf-8")

    rep = {"issues": [{"code": "PX_SEM_UNKNOWN_FUNCTION"}]}
    sem_line = REPORT_NEXT_LINE_BY_SLUG["report_next_sem"]
    onb = suggested_next_from_report(rep)
    ctx = suggested_next_from_report(rep, merge_order_bundle=alt)
    assert onb[0] == ONBOARDING_TRY_BUILD
    assert sem_line in onb
    assert ctx[0] == sem_line
    assert ctx.index(ONBOARDING_TRY_BUILD) > ctx.index(sem_line)

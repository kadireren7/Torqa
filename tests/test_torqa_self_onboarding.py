"""TORQA-authored CLI onboarding prefix (examples/torqa_self → user_hints)."""

from __future__ import annotations

import json
from pathlib import Path

from src.diagnostics.user_hints import (
    ONBOARDING_STARTER_LINE,
    ONBOARDING_TRY_BUILD,
    onboarding_suggested_next_prefix,
)
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.onboarding_ir import load_onboarding_suggested_next_prefix

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "cli_onboarding_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "cli_onboarding.tq"


def test_onboarding_prefix_matches_legacy_strings():
    prefix = onboarding_suggested_next_prefix()
    assert prefix == [
        ONBOARDING_TRY_BUILD,
        ONBOARDING_STARTER_LINE,
        "Templates: examples/torqa/templates/ (minimal.tq, login_flow.tq)",
    ]


def test_bundle_inputs_onboarding_order_stable():
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    names = [i["name"] for i in data["ir_goal"]["inputs"]]
    onboarding = [n for n in names if str(n).startswith("onboarding_")]
    assert onboarding == [
        "onboarding_try_build",
        "onboarding_starter_line",
        "onboarding_templates_line",
    ]


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_fallback_when_bundle_missing(tmp_path):
    out = load_onboarding_suggested_next_prefix(bundle_path=tmp_path / "nonexistent.json")
    assert len(out) == 3
    assert out[0].startswith("Try: torqa build")

"""Layered authoring passes from TORQA bundle (P12.1)."""

from __future__ import annotations

import json
from pathlib import Path

from src.language.authoring_prompt import language_reference_payload
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.layered_authoring_passes_ir import (
    layered_authoring_passes_list,
    layered_authoring_passes_list_with_fallback,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "layered_authoring_passes_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "layered_authoring_passes.tq"


def test_committed_bundle_matches_historical_four_lines():
    got = layered_authoring_passes_list()
    assert got is not None
    assert len(got) == 4
    assert got[0].startswith("A — skeleton")
    assert got[3].startswith("D — postconditions")


def test_payload_uses_same_list():
    p = language_reference_payload()
    assert p["layered_authoring_passes"] == layered_authoring_passes_list_with_fallback()


def test_fallback_on_bad_bundle(tmp_path):
    bad = tmp_path / "x.json"
    bad.write_text('{"ir_goal": {"inputs": []}}', encoding="utf-8")
    fb = layered_authoring_passes_list_with_fallback(
        bundle_path=Path("/__nonexistent__/layered.json"),
    )
    assert layered_authoring_passes_list_with_fallback(bundle_path=bad) == fb


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]

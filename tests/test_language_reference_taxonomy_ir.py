"""Language reference taxonomy from TORQA bundle (P12 central cluster)."""

from __future__ import annotations

import json
from pathlib import Path

from src.language.authoring_prompt import language_reference_payload
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.language_reference_taxonomy_ir import (
    language_reference_payload_taxonomy_slice,
    language_reference_taxonomy_lists,
    language_reference_taxonomy_lists_with_fallback,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "language_reference_taxonomy_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "language_reference_taxonomy.tq"


def test_committed_bundle_loads_six_lists_equal_to_historical_defaults():
    lists = language_reference_taxonomy_lists()
    assert lists is not None
    fb = language_reference_taxonomy_lists_with_fallback(bundle_path=Path("/__nonexistent__/torqa_bundle.json"))
    for key in fb:
        assert lists[key] == fb[key]


def test_payload_taxonomy_matches_loader():
    p = language_reference_payload()
    assert language_reference_payload_taxonomy_slice(p) == language_reference_taxonomy_lists_with_fallback()


def test_invalid_bundle_falls_back(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"ir_goal": {"inputs": []}}', encoding="utf-8")
    fb = language_reference_taxonomy_lists_with_fallback(bundle_path=Path("/__nonexistent__/torqa_bundle.json"))
    assert language_reference_taxonomy_lists_with_fallback(bundle_path=bad) == fb


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]

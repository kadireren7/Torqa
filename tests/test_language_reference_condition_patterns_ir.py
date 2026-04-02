"""language_reference_payload.condition_id_patterns from TORQA (P14)."""

from __future__ import annotations

import json
from pathlib import Path

from src.language.authoring_prompt import language_reference_payload
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.language_reference_condition_patterns_ir import (
    condition_id_patterns_dict,
    condition_id_patterns_with_fallback,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "language_reference_condition_patterns_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "language_reference_condition_patterns.tq"

_LEGACY: dict[str, str] = {
    "preconditions": "c_req_NNNN (four digits, unique)",
    "forbids": "c_forbid_NNNN",
    "postconditions": "c_post_NNNN",
    "transitions": "t_NNNN",
}


def test_committed_bundle_matches_legacy_values_and_order():
    d = condition_id_patterns_with_fallback()
    assert d == _LEGACY
    assert list(d.keys()) == ["preconditions", "forbids", "postconditions", "transitions"]


def test_payload_uses_same_dict():
    p = language_reference_payload()
    assert p["condition_id_patterns"] == condition_id_patterns_with_fallback()


def test_fallback_on_bad_bundle(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"ir_goal": {"inputs": []}}', encoding="utf-8")
    fb = condition_id_patterns_with_fallback(bundle_path=Path("/__nonexistent__/x.json"))
    assert condition_id_patterns_with_fallback(bundle_path=bad) == fb


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_reorder_swaps_key_order_in_dict(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    inputs = list(ig["inputs"])
    i_pre = next(i for i, r in enumerate(inputs) if r.get("name") == "condpat_preconditions")
    i_forbid = next(i for i, r in enumerate(inputs) if r.get("name") == "condpat_forbids")
    inputs[i_pre], inputs[i_forbid] = inputs[i_forbid], inputs[i_pre]
    ig["inputs"] = inputs
    alt = tmp_path / "reorder.json"
    alt.write_text(json.dumps(data, indent=2), encoding="utf-8")

    default = condition_id_patterns_with_fallback()
    custom = condition_id_patterns_with_fallback(bundle_path=alt)
    assert list(default.keys())[:2] == ["preconditions", "forbids"]
    assert list(custom.keys())[:2] == ["forbids", "preconditions"]
    assert custom == _LEGACY  # same key-value pairs
    assert condition_id_patterns_dict(bundle_path=alt) is not None


def test_committed_bundle_loads():
    assert condition_id_patterns_dict() is not None

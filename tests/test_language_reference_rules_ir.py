"""Language reference rules from TORQA (P13.x; P13.2 completes full seven-line self-host)."""

from __future__ import annotations

import json
from pathlib import Path

from src.language.authoring_prompt import language_reference_payload
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.language_reference_rules_ir import (
    language_reference_rules_list_with_fallback,
    language_reference_rules_prefix,
    language_reference_rules_prefix_with_fallback,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "language_reference_rules_prefix_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "language_reference_rules_prefix.tq"


def test_full_rules_list_is_seven_lines_and_matches_prefix():
    full = language_reference_rules_list_with_fallback()
    prefix = language_reference_rules_prefix_with_fallback()
    assert len(full) == 7
    assert full == prefix


def test_payload_rules_match_loader():
    p = language_reference_payload()
    assert p["rules"] == language_reference_rules_list_with_fallback()
    assert p["rules"] == language_reference_rules_prefix_with_fallback()


def test_fallback_on_bad_bundle(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"ir_goal": {"inputs": []}}', encoding="utf-8")
    fb = language_reference_rules_prefix_with_fallback(
        bundle_path=Path("/__nonexistent__/rules.json"),
    )
    assert language_reference_rules_prefix_with_fallback(bundle_path=bad) == fb


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_reordered_prefix_swaps_first_two_rule_lines(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    inputs = list(ig["inputs"])
    i_profile = next(i for i, r in enumerate(inputs) if r.get("name") == "policy_rule_profile")
    i_shape = next(i for i, r in enumerate(inputs) if r.get("name") == "policy_rule_output_shape")
    inputs[i_profile], inputs[i_shape] = inputs[i_shape], inputs[i_profile]
    ig["inputs"] = inputs
    alt = tmp_path / "reorder.json"
    alt.write_text(json.dumps(data, indent=2), encoding="utf-8")

    default = language_reference_rules_list_with_fallback()
    custom = language_reference_rules_list_with_fallback(rules_prefix_bundle=alt)
    assert default[0] != default[1]
    assert custom[0] == default[1] and custom[1] == default[0]
    assert custom[2:7] == default[2:7]


def test_committed_bundle_loads_prefix():
    assert language_reference_rules_prefix() is not None

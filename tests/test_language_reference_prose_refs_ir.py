"""diagnostics_issue_shape + aem_execution prose from TORQA (P14.1)."""

from __future__ import annotations

import json
from pathlib import Path

from src.language.authoring_prompt import language_reference_payload
from src.surface.parse_tq import parse_tq_source
from src.torqa_self.language_reference_prose_refs_ir import (
    language_reference_prose_refs_dict,
    language_reference_prose_refs_with_fallback,
)

REPO = Path(__file__).resolve().parents[1]
BUNDLE = REPO / "examples" / "torqa_self" / "language_reference_prose_refs_bundle.json"
TQ = REPO / "examples" / "torqa_self" / "language_reference_prose_refs.tq"

_LEGACY_DIAG = (
    "Each issue includes legacy phase plus formal_phase (FORMAL_CORE §2); "
    "repair loops should group by formal_phase."
)
_LEGACY_AEM = (
    "Reference Python and Rust executors enforce control state σ (before|after) and AEM_* halt codes; "
    "see docs/AEM_SPEC.md."
)


def test_committed_bundle_matches_legacy_strings():
    d = language_reference_prose_refs_with_fallback()
    assert d["diagnostics_issue_shape"] == _LEGACY_DIAG
    assert d["aem_execution"] == _LEGACY_AEM


def test_payload_uses_same_prose_refs():
    p = language_reference_payload()
    pr = language_reference_prose_refs_with_fallback()
    assert p["diagnostics_issue_shape"] == pr["diagnostics_issue_shape"]
    assert p["aem_execution"] == pr["aem_execution"]


def test_fallback_on_bad_bundle(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"ir_goal": {"inputs": []}}', encoding="utf-8")
    fb = language_reference_prose_refs_with_fallback(bundle_path=Path("/__nonexistent__/x.json"))
    assert language_reference_prose_refs_with_fallback(bundle_path=bad) == fb


def test_parse_tq_matches_committed_bundle_ir_goal():
    raw = TQ.read_text(encoding="utf-8")
    live = parse_tq_source(raw, tq_path=TQ.resolve())
    committed = json.loads(BUNDLE.read_text(encoding="utf-8"))
    assert live["ir_goal"]["goal"] == committed["ir_goal"]["goal"]
    assert live["ir_goal"]["inputs"] == committed["ir_goal"]["inputs"]


def test_slug_order_swap_does_not_change_mapped_strings(tmp_path):
    """Slug identity selects payload keys; input order alone does not swap diag vs aem text."""
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    ig = data["ir_goal"]
    inputs = list(ig["inputs"])
    orig_tail = [inputs[3]["name"], inputs[4]["name"]]
    i_d = next(i for i, r in enumerate(inputs) if r.get("name") == "ref_diag_issue_shape")
    i_a = next(i for i, r in enumerate(inputs) if r.get("name") == "ref_aem_execution")
    inputs[i_d], inputs[i_a] = inputs[i_a], inputs[i_d]
    ig["inputs"] = inputs
    assert [inputs[3]["name"], inputs[4]["name"]] != orig_tail
    alt = tmp_path / "reorder.json"
    alt.write_text(json.dumps(data, indent=2), encoding="utf-8")

    default = language_reference_prose_refs_with_fallback()
    custom = language_reference_prose_refs_with_fallback(bundle_path=alt)
    assert default == custom


def test_committed_bundle_loads():
    assert language_reference_prose_refs_dict() is not None

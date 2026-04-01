import json
from pathlib import Path

import pytest

from src.ir.canonical_ir import CANONICAL_IR_VERSION, ir_goal_from_json, validate_ir
from src.ir.migrate import migrate_ir_bundle

REPO = Path(__file__).resolve().parents[1]


def test_migrate_1_3_to_1_4_bumps_metadata_and_stays_valid():
    bundle = json.loads((REPO / "examples/core/valid_minimal_flow.json").read_text(encoding="utf-8"))
    bundle["ir_goal"]["metadata"]["ir_version"] = "1.3"
    new_b, w = migrate_ir_bundle(bundle, "1.3", "1.4")
    assert new_b["ir_goal"]["metadata"]["ir_version"] == "1.4"
    assert any("1.3 to 1.4" in x for x in w)
    g = ir_goal_from_json(new_b)
    assert not validate_ir(g)


def test_migrate_1_3_to_1_4_preserves_library_refs():
    bundle = json.loads((REPO / "examples/core/valid_bundle_with_library_refs.json").read_text(encoding="utf-8"))
    bundle["ir_goal"]["metadata"]["ir_version"] = "1.3"
    new_b, _ = migrate_ir_bundle(bundle, "1.3", "1.4")
    assert new_b.get("library_refs") == bundle.get("library_refs")


def test_migrate_rejects_unknown_path():
    bundle = json.loads((REPO / "examples/core/valid_minimal_flow.json").read_text(encoding="utf-8"))
    bundle["ir_goal"]["metadata"]["ir_version"] = "1.2"
    with pytest.raises(ValueError, match="No migration path"):
        migrate_ir_bundle(bundle, "1.2", CANONICAL_IR_VERSION)

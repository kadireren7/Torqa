import json
from pathlib import Path

from src.ir.canonical_ir import CANONICAL_IR_VERSION, ir_goal_from_json, validate_ir
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.surface.parse_pxir import parse_pxir_source

REPO = Path(__file__).resolve().parents[1]


def test_parse_minimal_pxir_matches_shape():
    raw = (REPO / "examples" / "surface" / "minimal.pxir").read_text(encoding="utf-8")
    bundle = parse_pxir_source(raw)
    assert bundle["ir_goal"]["goal"] == "MinimalFromSurface"
    assert bundle["ir_goal"]["metadata"]["ir_version"] == CANONICAL_IR_VERSION
    g = ir_goal_from_json(bundle)
    assert not validate_ir(g)
    rep = build_ir_semantic_report(g, default_ir_function_registry())
    assert rep["semantic_ok"] is True

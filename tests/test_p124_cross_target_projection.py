"""P124: cross-target projection parity and determinism (TORQA IR → surfaces)."""

from __future__ import annotations

import json
from pathlib import Path

from src.codegen.artifact_builder import generate_stub_artifact
from src.ir.canonical_ir import ir_goal_from_json
from src.projection.projection_contract import (
    TORQA_PROJECTION_SCHEMA_VERSION,
    build_p124_projection_manifest_artifact,
    enrich_artifact_with_torqa_projection,
    sorted_emit_paths,
)
from src.projection.projection_strategy import ProjectionTarget
from src.projection.python.emit import ir_goal_python_projection
from src.projection.rust.emit import ir_goal_rust_projection
from src.projection.semantic_fingerprint import ir_semantic_fingerprint
from src.projection.sql.emit import ir_goal_sql_projection
from src.projection.typescript.emit import ir_goal_typescript_index_projection
from src.surface.parse_tq import parse_tq_source

REPO = Path(__file__).resolve().parents[1]
FLAGSHIP = REPO / "examples" / "benchmark_flagship" / "app.tq"


def _flagship_goal():
    raw = FLAGSHIP.read_text(encoding="utf-8")
    bundle = parse_tq_source(raw, tq_path=FLAGSHIP)
    return ir_goal_from_json(bundle)


def test_semantic_fingerprint_stable() -> None:
    g = _flagship_goal()
    a = ir_semantic_fingerprint(g)
    b = ir_semantic_fingerprint(g)
    assert a == b
    assert a["goal"] == g.goal
    assert "username" in a["inputs_sorted"]


def test_cross_target_preserves_goal_and_inputs() -> None:
    g = _flagship_goal()
    fp = ir_semantic_fingerprint(g)
    py = ir_goal_python_projection(g)
    rs = ir_goal_rust_projection(g)
    sql = ir_goal_sql_projection(g)
    ts = ir_goal_typescript_index_projection(g)
    for blob in (py, rs, sql, ts):
        assert g.goal in blob
    for name in fp["inputs_sorted"]:
        assert name in sql
    assert "IR_BUNDLE" in ts
    assert "create session" in sql.lower() or "emit" in sql.lower() or "effect" in sql.lower()


def test_projection_deterministic_per_target() -> None:
    g = _flagship_goal()
    assert ir_goal_python_projection(g) == ir_goal_python_projection(g)
    assert ir_goal_rust_projection(g) == ir_goal_rust_projection(g)
    assert ir_goal_sql_projection(g) == ir_goal_sql_projection(g)
    assert ir_goal_typescript_index_projection(g) == ir_goal_typescript_index_projection(g)


def test_stub_artifact_has_p124_envelope() -> None:
    g = _flagship_goal()
    t = ProjectionTarget(language="python", purpose="service_backend", confidence=0.9, reasons=["test"])
    art = generate_stub_artifact(g, t)
    tp = art.get("torqa_projection")
    assert isinstance(tp, dict)
    assert tp.get("schema_version") == TORQA_PROJECTION_SCHEMA_VERSION
    assert tp.get("target_stack") == "python_service_stub"
    assert tp.get("emit_paths_sorted") == sorted_emit_paths(art)


def test_manifest_lists_surfaces_and_matches_fingerprint() -> None:
    g = _flagship_goal()
    t_py = ProjectionTarget(language="python", purpose="service_backend", confidence=0.9, reasons=["t"])
    art = [generate_stub_artifact(g, t_py)]
    man = build_p124_projection_manifest_artifact(g, art)
    raw = next(f["content"] for f in man["files"] if f["filename"].endswith("p124_projection_manifest.json"))
    data = json.loads(raw)
    assert data["manifest_version"] == TORQA_PROJECTION_SCHEMA_VERSION
    assert data["ir_semantics"] == ir_semantic_fingerprint(g)
    assert len(data["surfaces"]) == 1
    assert data["surfaces"][0]["target_stack"] == "python_service_stub"


def test_enrich_sorts_paths_deterministically() -> None:
    art: dict = {
        "target_language": "typescript",
        "purpose": "frontend_surface",
        "files": [
            {"filename": "generated/webapp/b.ts", "content": "x"},
            {"filename": "generated/webapp/a.ts", "content": "y"},
        ],
    }
    enrich_artifact_with_torqa_projection(art, target_stack="typescript_webapp")
    assert art["torqa_projection"]["emit_paths_sorted"] == [
        "generated/webapp/a.ts",
        "generated/webapp/b.ts",
    ]

"""
Project-X web console (English): load core IR examples, run verifier + orchestrator, preview projections.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.execution.engine_routing import run_rust_pipeline_with_fallback
from src.ir.canonical_ir import (
    compute_ir_fingerprint,
    ir_goal_from_json,
    ir_goal_to_json,
    validate_ir,
    validate_ir_handoff_compatibility,
)
from src.orchestrator.system_orchestrator import SystemOrchestrator
from src.projection.projection_graph import projection_graph_to_json
from src.projection.projection_strategy import ProjectionContext, projection_plan_to_json
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry

REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMPLES_DIR = REPO_ROOT / "examples" / "core"
STATIC_DIR = Path(__file__).resolve().parent / "static"


class RunRequest(BaseModel):
    ir_bundle: Dict[str, Any] = Field(..., description='Envelope {"ir_goal": {...}}')
    demo_inputs: Optional[Dict[str, Any]] = None
    engine_mode: Literal["rust_preferred", "python_only", "rust_only"] = "rust_preferred"


app = FastAPI(
    title="Project-X Console",
    description="AI-first core IR: validate, execute (engine), generate projections.",
    version="0.1.0",
)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index_page():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(500, "static UI missing: webui/static/index.html")
    return FileResponse(index)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "project-x-webui"}


@app.get("/api/examples")
def list_examples():
    if not EXAMPLES_DIR.is_dir():
        return {"examples": []}
    out: List[Dict[str, str]] = []
    for p in sorted(EXAMPLES_DIR.glob("*.json")):
        out.append({"name": p.name, "path": str(p.relative_to(REPO_ROOT)).replace("\\", "/")})
    return {"examples": out}


@app.get("/api/examples/{name}")
def get_example(name: str):
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(400, "invalid name")
    path = EXAMPLES_DIR / name
    if not path.is_file():
        raise HTTPException(404, "example not found")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/run")
def run_pipeline(body: RunRequest):
    try:
        ir_goal = ir_goal_from_json(body.ir_bundle)
    except Exception as ex:
        raise HTTPException(400, f"IR parse failed: {ex}") from ex

    v_err = validate_ir(ir_goal)
    h_err = validate_ir_handoff_compatibility(ir_goal)
    reg = default_ir_function_registry()
    semantic = build_ir_semantic_report(ir_goal, reg)
    fp = compute_ir_fingerprint(ir_goal)

    routing: Dict[str, Any] = {}
    rust_block: Dict[str, Any] = {}
    fallback: Dict[str, Any] = {}
    try:
        routing, rust_block, fallback = run_rust_pipeline_with_fallback(
            ir_goal,
            dict(body.demo_inputs or {}),
            mode=body.engine_mode,
        )
    except Exception as ex:
        rust_block = {"error": str(ex)}

    orch = SystemOrchestrator(ir_goal, context=ProjectionContext(), engine_mode=body.engine_mode)
    orch_out = orch.run_v4() if hasattr(orch, "run_v4") else orch.run()

    ir_valid = len(v_err) == 0 and len(h_err) == 0

    plan = orch_out.get("projection_plan")
    graph = orch_out.get("graph")
    return {
        "ir_valid": ir_valid,
        "validation_errors": v_err,
        "handoff_errors": h_err,
        "fingerprint": fp,
        "semantic": semantic,
        "engine": {
            "routing": routing,
            "rust_output": rust_block,
            "fallback": fallback,
        },
        "orchestrator": {
            "consistency_errors": orch_out.get("consistency_errors", []),
            "artifacts": orch_out.get("artifacts", []),
            "projection_plan": projection_plan_to_json(plan)["projection_plan"] if plan else None,
            "projection_graph": projection_graph_to_json(graph)["projection_graph"] if graph else None,
            "semantic": orch_out.get("semantic"),
            "manifest": orch_out.get("manifest"),
            "self_analysis_report": orch_out.get("self_analysis_report"),
        },
        "ir_bundle_echo": ir_goal_to_json(ir_goal),
    }

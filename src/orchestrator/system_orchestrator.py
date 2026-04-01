"""
IR-centric system orchestration (V3).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from src.ir.canonical_ir import IRGoal
from src.control.capability_registry import build_capability_registry, build_system_manifest, resolve_preferred_engine
from src.execution.engine_routing import run_rust_pipeline_with_fallback
from src.orchestrator.internal_tooling import (
    build_self_analysis_report,
    prune_empty_artifacts,
    prune_obsolete_metadata,
    prune_unused_projection_targets,
)
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.projection.projection_graph import (
    ProjectionGraph,
    build_projection_graph,
    projection_graph_to_json,
)
from src.projection.projection_strategy import (
    ProjectionContext,
    ProjectionPlan,
    ProjectionTarget,
    choose_projection_targets,
    projection_plan_to_json,
)
from src.codegen.artifact_builder import generate_all_artifacts


def generate_all_targets(ir_goal: IRGoal, projection_plan: ProjectionPlan) -> List[Dict[str, Any]]:
    return generate_all_artifacts(ir_goal, projection_plan)


def validate_projection_consistency(
    graph: ProjectionGraph, artifacts: List[Dict[str, Any]]
) -> List[str]:
    errors: List[str] = []
    node_langs = {n.target.language for n in graph.nodes}
    artifact_langs = {a.get("target_language") for a in artifacts}
    missing = node_langs - artifact_langs
    if missing:
        errors.append(f"Projection consistency: missing artifacts for targets {sorted(missing)}.")

    for e in graph.edges:
        if e.relation_type not in {"depends_on", "feeds", "mirrors"}:
            errors.append(f"Projection consistency: invalid relation_type '{e.relation_type}'.")

    # Lightweight content consistency check over generated outputs.
    seen_non_empty_files = 0
    for a in artifacts:
        for f in a.get("files", []):
            if "content" in f and isinstance(f["content"], str):
                if f["content"].strip():
                    seen_non_empty_files += 1
    if seen_non_empty_files == 0:
        errors.append("Projection consistency: artifacts do not contain non-empty generated file content.")

    return errors


class SystemOrchestrator:
    def __init__(
        self,
        ir_goal: IRGoal,
        context: Optional[ProjectionContext] = None,
        engine_mode: str = "rust_preferred",
        demo_inputs: Optional[Dict[str, Any]] = None,
    ):
        self.ir_goal = ir_goal
        self.context = context or ProjectionContext()
        self.engine_mode = engine_mode
        self.demo_inputs = dict(demo_inputs or {})

    def run(self) -> Dict[str, Any]:
        semantic_report = build_ir_semantic_report(
            self.ir_goal, default_ir_function_registry()
        )
        projection_plan = choose_projection_targets(
            self.ir_goal,
            semantic_report,
            execution_summary=None,
            context=self.context,
        )
        graph = build_projection_graph(self.ir_goal, projection_plan)
        artifacts = generate_all_targets(self.ir_goal, projection_plan)
        consistency_errors = validate_projection_consistency(graph, artifacts)
        return {
            "semantic": semantic_report,
            "projection_plan": projection_plan,
            "graph": graph,
            "artifacts": artifacts,
            "consistency_errors": consistency_errors,
            "engine_mode": self.engine_mode,
        }

    def run_v4(self) -> Dict[str, Any]:
        # Maintenance pruning on IR metadata before analysis.
        self.ir_goal = prune_obsolete_metadata(self.ir_goal)
        semantic_report = build_ir_semantic_report(
            self.ir_goal, default_ir_function_registry()
        )
        projection_plan = choose_projection_targets(
            self.ir_goal, semantic_report, execution_summary=None, context=self.context
        )
        projection_plan = prune_unused_projection_targets(projection_plan)
        graph = build_projection_graph(self.ir_goal, projection_plan)
        artifacts = generate_all_targets(self.ir_goal, projection_plan)
        artifacts = prune_empty_artifacts(artifacts)
        consistency_errors = validate_projection_consistency(graph, artifacts)
        self_report = build_self_analysis_report(
            self.ir_goal,
            semantic_report,
            projection_plan,
            graph,
            artifacts,
            execution_result=None,
            consistency_errors=consistency_errors,
        )
        return {
            "semantic": semantic_report,
            "projection_plan": projection_plan,
            "graph": graph,
            "artifacts": artifacts,
            "consistency_errors": consistency_errors,
            "manifest": build_system_manifest(),
            "capability_registry": [
                {
                    "name": c.name,
                    "layer": c.layer,
                    "status": c.status,
                    "owner": c.owner,
                    "notes": list(c.notes),
                    "preferred_engine": resolve_preferred_engine(c.name),
                }
                for c in build_capability_registry()
            ],
            "self_analysis_report": self_report,
            "maintenance": {
                "pruned_low_confidence_targets": True,
                "pruned_empty_artifacts": True,
                "pruned_obsolete_metadata": True,
            },
            "engine_mode": self.engine_mode,
        }

    def run_v6(self) -> Dict[str, Any]:
        v4 = self.run_v4()
        routing, rust_output, fallback_status = run_rust_pipeline_with_fallback(
            self.ir_goal, self.demo_inputs, mode=self.engine_mode
        )
        return {
            **v4,
            "engine": {
                "mode": self.engine_mode,
                "chosen_engine": "python" if fallback_status.get("used") else "rust",
                "fallback_occurred": bool(fallback_status.get("used")),
                "fallback_reason": fallback_status.get("reason", ""),
                "routing": routing,
                "parity_comparison_summary": fallback_status.get("parity_summary", {}),
            },
            "rust_pipeline": rust_output,
        }


def orchestrator_to_json(output: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "orchestrator_output": {
            "semantic": output["semantic"],
            "projection_plan": projection_plan_to_json(output["projection_plan"])["projection_plan"],
            "graph": projection_graph_to_json(output["graph"])["projection_graph"],
            "artifacts": output["artifacts"],
            "consistency_errors": list(output["consistency_errors"]),
        }
    }

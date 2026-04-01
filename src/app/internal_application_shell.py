"""
V6.3 internal application shell for end-to-end system testing.

This is an internal testing surface, not a public product UI.
It enforces editor-session-driven mutation and canonical IR source-of-truth discipline.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Sequence

from src.control.capability_registry import build_capability_registry, build_system_manifest
from src.ir.canonical_ir import ir_goal_to_json
from src.editor.editor_core import (
    EditorOperation,
    EditorSession,
    apply_editor_operations,
    create_editor_session,
    get_editor_diagnostics,
    get_editor_views,
    preview_editor_state,
)
from src.projection.projection_graph import build_projection_graph, projection_graph_to_json
from src.projection.projection_strategy import choose_projection_targets, projection_plan_to_json
from src.orchestrator.system_orchestrator import generate_all_targets, validate_projection_consistency
from src.codegen.artifact_builder import (
    build_generation_plan,
    can_generate_simple_website,
    validate_generated_artifacts,
)


def _validate_artifacts(artifacts: List[Dict[str, Any]]) -> Dict[str, Any]:
    file_count = sum(len(a.get("files") or []) for a in artifacts)
    errors = validate_generated_artifacts(artifacts)
    return {
        "artifact_validation_passed": len(errors) == 0,
        "errors": errors,
        "artifact_count": len(artifacts),
        "file_count": file_count,
    }


def website_success_gate(result: Dict[str, Any]) -> bool:
    threshold_passed = bool((result.get("threshold_test") or {}).get("passed"))
    artifacts_ok = bool((result.get("artifact_validation") or {}).get("artifact_validation_passed"))
    semantic_clean = bool((result.get("semantic_report") or {}).get("semantic_ok"))
    consistency_errors = list(result.get("consistency_errors") or [])
    fatal_consistency = any("invalid" in e.lower() or "missing" in e.lower() for e in consistency_errors)
    return threshold_passed and artifacts_ok and semantic_clean and not fatal_consistency


def build_checkpoint_package(
    *,
    shell_status: Dict[str, Any],
    generation_result: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "canonical_ir_snapshot": generation_result.get("ir_snapshot"),
        "semantic_report_summary": {
            "semantic_ok": bool((generation_result.get("semantic_report") or {}).get("semantic_ok")),
            "error_count": len((generation_result.get("semantic_report") or {}).get("errors") or []),
            "warning_count": len((generation_result.get("semantic_report") or {}).get("warnings") or []),
        },
        "projection_plan_summary": generation_result.get("projection_plan"),
        "generation_report": {
            "artifact_validation": generation_result.get("artifact_validation"),
            "consistency_errors": generation_result.get("consistency_errors"),
            "artifacts_count": len(generation_result.get("artifacts") or []),
        },
        "threshold_test_result": generation_result.get("threshold_test"),
        "application_shell_status": shell_status,
        "manifest": build_system_manifest(),
        "capability_registry_summary": [
            {
                "name": c.name,
                "status": c.status,
                "owner": c.owner,
                "layer": c.layer,
            }
            for c in build_capability_registry()
        ],
    }


def validate_git_checkpoint_readiness(
    *,
    generation_result: Dict[str, Any],
    shell_status: Dict[str, Any],
) -> List[str]:
    errors: List[str] = []
    if not website_success_gate(generation_result):
        errors.append("Website success gate did not pass.")
    if any("invalid relation_type" in str(e).lower() for e in generation_result.get("consistency_errors", [])):
        errors.append("Fatal orchestrator consistency issue detected.")
    diagnostics = list(shell_status.get("editor_diagnostics") or [])
    fatal_diags = [d for d in diagnostics if d.get("severity") == "error"]
    if fatal_diags:
        errors.append("Unresolved fatal editor diagnostics present.")
    for doc in (
        "website_generation_threshold.md",
        "generation_plan_contract.md",
        "artifact_quality_rules.md",
        "editor_architecture.md",
        "editor_session_contract.md",
        "editor_diagnostics_model.md",
        "rust_dominance_status.md",
        "parity_status_report.md",
    ):
        if doc not in shell_status.get("docs_present", []):
            errors.append(f"Missing canonical documentation: {doc}")
    if not shell_status.get("cleanup_state_recorded", False):
        errors.append("Cleanup/deprecation state not recorded.")
    if not shell_status.get("artifacts_tracking_policy"):
        errors.append("Generated artifacts tracking-vs-ignored policy not declared.")
    return errors


class InternalApplicationShell:
    def __init__(
        self,
        ir_goal,
        engine_mode: str = "rust_preferred",
        demo_inputs: Optional[Dict[str, Any]] = None,
    ):
        self.session: EditorSession = create_editor_session(
            ir_goal,
            engine_mode=engine_mode,
            demo_inputs=demo_inputs or {},
        )
        self.last_generation_result: Dict[str, Any] = {}
        self.ready_for_checkpoint_commit: bool = False

    def apply_operations(self, operations: Sequence[EditorOperation]) -> Dict[str, Any]:
        # Enforced routing: shell action -> editor session APIs only.
        return apply_editor_operations(self.session, operations)

    def build_simple_website(self) -> Dict[str, Any]:
        state = preview_editor_state(self.session)
        projection_plan_obj = self.session.last_projection_plan
        graph = build_projection_graph(self.session.ir_goal, projection_plan_obj)
        generation_plan = build_generation_plan(self.session.ir_goal, projection_plan_obj)
        artifacts = generate_all_targets(self.session.ir_goal, projection_plan_obj)
        consistency_errors = validate_projection_consistency(graph, artifacts)
        artifact_validation = _validate_artifacts(artifacts)
        threshold_test = can_generate_simple_website(
            self.session.ir_goal,
            projection_plan_obj,
            artifacts,
        )
        out = {
            "semantic_report": self.session.last_semantic_report,
            "projection_plan": projection_plan_to_json(projection_plan_obj)["projection_plan"],
            "generation_plan": generation_plan,
            "projection_graph": projection_graph_to_json(graph)["projection_graph"],
            "artifacts": artifacts,
            "artifact_validation": artifact_validation,
            "threshold_test": threshold_test,
            "consistency_errors": consistency_errors,
            "execution_preview": state.get("execution_preview", {}),
            "ir_snapshot": ir_goal_to_json(self.session.ir_goal)["ir_goal"],
        }
        self.ready_for_checkpoint_commit = website_success_gate(out)
        out["ready_for_checkpoint_commit"] = self.ready_for_checkpoint_commit
        self.last_generation_result = out
        return out

    def shell_status(self) -> Dict[str, Any]:
        views = get_editor_views(self.session)
        docs = [
            "website_generation_threshold.md",
            "generation_plan_contract.md",
            "artifact_quality_rules.md",
            "editor_architecture.md",
            "editor_session_contract.md",
            "editor_diagnostics_model.md",
            "rust_dominance_status.md",
            "parity_status_report.md",
        ]
        docs_root = os.path.join(os.getcwd(), "docs")
        docs_present = [d for d in docs if os.path.exists(os.path.join(docs_root, d))]
        return {
            "shell_type": "internal_testing_surface",
            "final_product": False,
            "engine_mode": self.session.engine_mode,
            "editor_history": self.session.history,
            "editor_diagnostics": get_editor_diagnostics(self.session),
            "editor_views": views,
            "docs_present": docs_present,
            "cleanup_state_recorded": True,
            "artifacts_tracking_policy": "Generated artifacts are checkpoint outputs; keep explicit tracked-vs-ignored policy in repo.",
            "ready_for_checkpoint_commit": self.ready_for_checkpoint_commit,
        }

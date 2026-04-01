"""
V5.3 integrated platform: edit engine + control layer + IR mutation + Rust-first
execution + Python projection + self-analysis + evolution + optimization feedback.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.ir.canonical_ir import IRGoal, normalize_ir_goal
from src.execution.engine_routing import run_rust_pipeline_with_fallback
from src.orchestrator.internal_tooling import (
    build_self_analysis_report,
    prune_empty_artifacts,
    prune_obsolete_metadata,
    prune_unused_projection_targets,
)
from src.editor.ir_edit_engine import IREditOperation, IREditTransaction, apply_edit_transaction
from src.control.ir_mutation import IRMutation, apply_ir_mutation_batch
from src.control.ir_optimizer import optimize_ir_goal_with_report
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.projection.projection_graph import build_projection_graph
from src.projection.projection_strategy import ProjectionContext, choose_projection_targets
from src.evolution.self_evolution import evolve_ir
from src.orchestrator.system_orchestrator import generate_all_targets, validate_projection_consistency


def compute_system_stability(
    *,
    edit_success: bool,
    mutation_success: bool,
    execution_success: bool,
    semantic_ok: bool,
    rust_ir_valid: Optional[bool],
    consistency_ok: bool,
    fallback_used: bool,
    max_risk_score: float,
    evolution_iterations: int,
    semantic_error_count: int,
) -> float:
    score = 1.0
    if not edit_success:
        score -= 0.22
    if not mutation_success:
        score -= 0.18
    if not execution_success:
        score -= 0.28
    if not semantic_ok:
        score -= 0.18
    if rust_ir_valid is False:
        score -= 0.12
    if not consistency_ok:
        score -= 0.1
    if fallback_used:
        score -= 0.06
    score -= min(0.18, float(max_risk_score) * 0.22)
    score -= min(0.12, int(evolution_iterations) * 0.03)
    score -= min(0.2, int(semantic_error_count) * 0.035)
    return max(0.0, min(1.0, score))


def _risk_level(stability: float) -> str:
    if stability >= 0.75:
        return "low"
    if stability >= 0.45:
        return "medium"
    return "high"


def _max_edit_risk(edit_report: Dict[str, Any]) -> float:
    risks = edit_report.get("mutation_risks") or []
    if not risks:
        return 0.0
    return max(float(r.get("risk_score", 0.0)) for r in risks)


def _extract_execution(
    rust_output: Dict[str, Any], fallback: Dict[str, Any]
) -> Tuple[bool, Dict[str, Any]]:
    ex = rust_output.get("execution_result")
    if isinstance(ex, dict) and ex:
        return bool(ex.get("success")), dict(ex)
    if fallback.get("used"):
        py = fallback.get("python_result") or {}
        inner = (py.get("execution") or {}).get("execution_result") or {}
        if isinstance(inner, dict):
            return bool(inner.get("success")), dict(inner)
    return False, {}


class PlatformController:
    def __init__(
        self,
        ir_goal: IRGoal,
        demo_inputs: Optional[Dict[str, Any]] = None,
        engine_mode: str = "rust_preferred",
        projection_context: Optional[ProjectionContext] = None,
        max_evolution_iterations: int = 3,
    ):
        self.ir_goal = normalize_ir_goal(ir_goal)
        self.demo_inputs = dict(demo_inputs or {})
        self.engine_mode = engine_mode
        self.projection_context = projection_context or ProjectionContext()
        self.max_evolution_iterations = max_evolution_iterations

    def run_edit(self, transaction: IREditTransaction) -> Tuple[IRGoal, Dict[str, Any]]:
        ir, report = apply_edit_transaction(self.ir_goal, transaction)
        self.ir_goal = ir
        return ir, report

    def run_execution(self, ir_goal: Optional[IRGoal] = None) -> Dict[str, Any]:
        target = normalize_ir_goal(ir_goal) if ir_goal is not None else self.ir_goal
        routing, rust_out, fallback = run_rust_pipeline_with_fallback(
            target, self.demo_inputs, self.engine_mode
        )
        ok, exec_result = _extract_execution(rust_out, fallback)
        return {
            "routing": routing,
            "rust_output": rust_out,
            "fallback": fallback,
            "execution_success": ok,
            "execution_result": exec_result,
        }

    def run_full_cycle(
        self,
        edit_transaction: Optional[IREditTransaction] = None,
        post_mutations: Optional[List[IRMutation]] = None,
    ) -> Dict[str, Any]:
        ir = normalize_ir_goal(prune_obsolete_metadata(self.ir_goal))
        edit_report: Dict[str, Any] = {}
        edit_success = True
        if edit_transaction is not None:
            ir, edit_report = apply_edit_transaction(ir, edit_transaction)
            edit_success = edit_report.get("status") == "committed"

        mutation_success = True
        mutation_error: Optional[str] = None
        if post_mutations:
            try:
                ir = apply_ir_mutation_batch(ir, list(post_mutations))
                ir = normalize_ir_goal(ir)
            except Exception as ex:
                mutation_success = False
                mutation_error = str(ex)

        exec_bundle = self.run_execution(ir)
        routing = exec_bundle["routing"]
        rust_out = exec_bundle["rust_output"]
        fallback = exec_bundle["fallback"]
        execution_success = exec_bundle["execution_success"]
        exec_result = exec_bundle["execution_result"]

        reg = default_ir_function_registry()
        semantic_report = build_ir_semantic_report(ir, reg)
        semantic_ok = bool(semantic_report.get("semantic_ok"))
        sem_err_n = len(semantic_report.get("errors") or [])

        projection_plan = choose_projection_targets(
            ir,
            semantic_report,
            execution_summary=exec_result,
            context=self.projection_context,
        )
        projection_plan = prune_unused_projection_targets(projection_plan)
        graph = build_projection_graph(ir, projection_plan)
        artifacts = generate_all_targets(ir, projection_plan)
        artifacts = prune_empty_artifacts(artifacts)
        consistency_errors = validate_projection_consistency(graph, artifacts)
        consistency_ok = len(consistency_errors) == 0

        self_analysis = build_self_analysis_report(
            ir,
            semantic_report,
            projection_plan,
            graph,
            artifacts,
            exec_result,
            consistency_errors,
        )

        evolved_ir, evolution_report = evolve_ir(
            ir,
            max_iterations=self.max_evolution_iterations,
            semantic_report=semantic_report,
            execution_result=exec_result,
            projection_plan=projection_plan,
            artifacts=artifacts,
            consistency_errors=consistency_errors,
        )

        optimized_ir, optimization_report = optimize_ir_goal_with_report(evolved_ir)
        self.ir_goal = normalize_ir_goal(optimized_ir)

        rust_ir_valid = rust_out.get("ir_valid")
        if not isinstance(rust_ir_valid, bool):
            rust_ir_valid = None

        iterations_run = int(evolution_report.get("iterations", 0))
        max_risk = _max_edit_risk(edit_report) if edit_report else 0.0

        stability = compute_system_stability(
            edit_success=edit_success,
            mutation_success=mutation_success,
            execution_success=execution_success,
            semantic_ok=semantic_ok,
            rust_ir_valid=rust_ir_valid,
            consistency_ok=consistency_ok,
            fallback_used=bool(fallback.get("used")),
            max_risk_score=max_risk,
            evolution_iterations=iterations_run,
            semantic_error_count=sem_err_n,
        )

        platform_report = {
            "edit_success": edit_success,
            "mutation_success": mutation_success,
            "execution_success": execution_success,
            "stability_score": round(stability, 4),
            "risk_level": _risk_level(stability),
            "semantic_ok": semantic_ok,
            "consistency_ok": consistency_ok,
            "rust_ir_valid": rust_ir_valid,
            "fallback_used": bool(fallback.get("used")),
            "chosen_engine": "python" if fallback.get("used") else "rust",
            "fallback_reason": fallback.get("reason", ""),
            "parity_comparison_summary": fallback.get("parity_summary", {}),
            "execution_result_snapshot": exec_result,
            "routing": routing,
        }

        detail: Dict[str, Any] = {
            "ir_final": self.ir_goal,
            "edit_report": edit_report,
            "mutation_error": mutation_error,
            "exec_bundle": exec_bundle,
            "semantic_report": semantic_report,
            "projection_plan": projection_plan,
            "graph": graph,
            "artifacts": artifacts,
            "consistency_errors": consistency_errors,
            "self_analysis": self_analysis,
            "evolution_report": evolution_report,
            "optimization_report": optimization_report,
        }

        return {"platform_report": platform_report, "detail": detail}


def edit_and_execute(
    ir_goal: IRGoal,
    edit_operations: Sequence[IREditOperation],
    demo_inputs: Optional[Dict[str, Any]] = None,
    engine_mode: str = "rust_preferred",
    projection_context: Optional[ProjectionContext] = None,
) -> Dict[str, Any]:
    controller = PlatformController(
        ir_goal,
        demo_inputs=demo_inputs,
        engine_mode=engine_mode,
        projection_context=projection_context,
    )
    tx = IREditTransaction(list(edit_operations))
    out = controller.run_full_cycle(edit_transaction=tx)
    out["detail"]["edit_and_execute"] = True
    return out

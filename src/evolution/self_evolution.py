from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.ir.canonical_ir import IRCall, IRGoal, IRIdentifier, normalize_ir_goal
from src.control.ir_mutation import IRMutation, apply_ir_mutation_batch
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.projection.projection_strategy import ProjectionPlan, ProjectionTarget, choose_projection_targets
from src.orchestrator.system_orchestrator import SystemOrchestrator


def _target_ids(ir_goal: IRGoal) -> Dict[str, set]:
    return {
        "pre": {c.condition_id for c in ir_goal.preconditions},
        "forbid": {c.condition_id for c in ir_goal.forbids},
    }


def _next_condition_id(ir_goal: IRGoal, prefix: str) -> str:
    ids = _target_ids(ir_goal)
    used = ids["pre"] | ids["forbid"]
    i = 1
    while True:
        cid = f"{prefix}{i:04d}"
        if cid not in used:
            return cid
        i += 1


def _has_exists_precondition(ir_goal: IRGoal, input_name: str) -> bool:
    for c in ir_goal.preconditions:
        expr = c.expr
        if isinstance(expr, IRCall) and expr.name == "exists" and len(expr.arguments) == 1:
            arg = expr.arguments[0]
            if isinstance(arg, IRIdentifier) and arg.name == input_name:
                return True
    return False


def _default_plan(ir_goal: IRGoal) -> ProjectionPlan:
    return ProjectionPlan(
        primary_target=ProjectionTarget("python", "tooling_bridge", 0.5, ["Default fallback plan"]),
        secondary_targets=[],
        strategy_notes=[],
    )


def generate_ir_improvement_mutations(
    ir_goal: IRGoal,
    semantic_report: Dict[str, Any],
    execution_result: Dict[str, Any],
    projection_plan: ProjectionPlan,
    artifacts: List[Dict[str, Any]],
    consistency_errors: List[str],
) -> List[IRMutation]:
    """
    Rule-based mutation generation from feedback signals.
    """
    mutations: List[IRMutation] = []
    input_names = [i.name for i in ir_goal.inputs]
    sem_errors = list(semantic_report.get("errors", []))
    sem_warnings = list(semantic_report.get("warnings", []))

    # A. Missing guarantee fix -> add require exists(<identifier>)
    for err in sem_errors:
        if "has no before-state guarantee" in err and input_names:
            picked = None
            for name in input_names:
                if f"'{name}'" in err:
                    picked = name
                    break
            if picked is None:
                picked = input_names[0]
            if not _has_exists_precondition(ir_goal, picked):
                mutations.append(
                    IRMutation(
                        "add_precondition",
                        target=None,
                        payload={
                            "condition_id": _next_condition_id(ir_goal, "c_req_"),
                            "expr": IRCall("exists", [IRIdentifier(picked, semantic_type="unknown")]),
                        },
                    )
                )
                break

    # B. Weak preconditions -> strengthen by adding deterministic exists() guard.
    if input_names and any("weak" in w.lower() and "precondition" in w.lower() for w in sem_warnings):
        picked = input_names[0]
        if not _has_exists_precondition(ir_goal, picked):
            mutations.append(
                IRMutation(
                    "add_precondition",
                    target=None,
                    payload={
                        "condition_id": _next_condition_id(ir_goal, "c_req_"),
                        "expr": IRCall("exists", [IRIdentifier(picked, semantic_type="unknown")]),
                    },
                )
            )

    # C. Execution failure -> adjust constraints.
    if not bool(execution_result.get("success", True)):
        failed_step = execution_result.get("failed_step") or {}
        kind = failed_step.get("kind")
        detail = failed_step.get("detail") or {}
        if kind == "check_forbidden" and ir_goal.forbids:
            idx = int(detail.get("index", 0))
            if 0 <= idx < len(ir_goal.forbids):
                mutations.append(
                    IRMutation("remove_forbid", target=ir_goal.forbids[idx].condition_id, payload={})
                )
        elif kind == "check_precondition" and ir_goal.preconditions:
            idx = int(detail.get("index", 0))
            if 0 <= idx < len(ir_goal.preconditions):
                mutations.append(
                    IRMutation(
                        "remove_precondition", target=ir_goal.preconditions[idx].condition_id, payload={}
                    )
                )

    # D. Projection weakness -> adjust structure.
    weak_projection = bool(consistency_errors) or len(artifacts) == 0
    if not weak_projection:
        weak_projection = float(getattr(projection_plan.primary_target, "confidence", 1.0)) < 0.55
    if weak_projection and not ir_goal.inputs:
        mutations.append(
            IRMutation(
                "add_input",
                target=None,
                payload={"name": "context_id", "type_name": "text"},
            )
        )

    # Deterministic, bounded mutation list.
    return mutations[:3]


def refine_ir_with_feedback(
    ir_goal: IRGoal,
    artifacts: List[Dict[str, Any]],
    execution_result: Dict[str, Any],
    semantic_report: Dict[str, Any],
    projection_plan: ProjectionPlan,
    consistency_errors: List[str],
) -> Tuple[IRGoal, List[IRMutation]]:
    mutations = generate_ir_improvement_mutations(
        ir_goal,
        semantic_report,
        execution_result,
        projection_plan,
        artifacts,
        consistency_errors,
    )
    if not mutations:
        return normalize_ir_goal(ir_goal), []
    evolved = apply_ir_mutation_batch(ir_goal, mutations)
    return normalize_ir_goal(evolved), mutations


def _issue_score(
    semantic_report: Dict[str, Any],
    consistency_errors: List[str],
    projection_plan: ProjectionPlan,
    execution_result: Dict[str, Any],
) -> float:
    score = 0.0
    score += float(len(semantic_report.get("errors", []))) * 0.3
    score += float(len(consistency_errors)) * 0.2
    score += max(0.0, 0.6 - float(getattr(projection_plan.primary_target, "confidence", 0.0)))
    if not bool(execution_result.get("success", True)):
        score += 0.6
    return score


def evolve_ir(
    ir_goal,
    max_iterations=3,
    semantic_report: Dict[str, Any] | None = None,
    execution_result: Dict[str, Any] | None = None,
    projection_plan: ProjectionPlan | None = None,
    artifacts: List[Dict[str, Any]] | None = None,
    consistency_errors: List[str] | None = None,
):
    current = normalize_ir_goal(ir_goal)
    applied: List[Dict[str, Any]] = []
    last_score = 0.0
    first_score = None
    iterations_run = 0

    for i in range(max_iterations):
        sem = (
            semantic_report
            if i == 0 and semantic_report is not None
            else build_ir_semantic_report(current, default_ir_function_registry())
        )
        plan = (
            projection_plan
            if i == 0 and projection_plan is not None
            else choose_projection_targets(current, sem, execution_summary=None, context=None)
        )
        if i == 0 and artifacts is not None and consistency_errors is not None:
            art = list(artifacts)
            consistency = list(consistency_errors)
        else:
            orch = SystemOrchestrator(current).run()
            art = list(orch.get("artifacts", []))
            consistency = list(orch.get("consistency_errors", []))
        exec_result: Dict[str, Any] = (
            dict(execution_result) if i == 0 and execution_result is not None else {"success": True}
        )

        score_before = _issue_score(sem, consistency, plan, exec_result)
        if first_score is None:
            first_score = score_before

        next_ir, muts = refine_ir_with_feedback(
            current,
            artifacts=art,
            execution_result=exec_result,
            semantic_report=sem,
            projection_plan=plan,
            consistency_errors=consistency,
        )
        iterations_run += 1
        if not muts:
            last_score = score_before
            break

        applied.extend(
            [
                {
                    "iteration": i + 1,
                    "mutation_type": m.mutation_type,
                    "target": m.target,
                    "payload": m.payload,
                }
                for m in muts
            ]
        )

        sem_after = build_ir_semantic_report(next_ir, default_ir_function_registry())
        plan_after = choose_projection_targets(next_ir, sem_after, execution_summary=None, context=None)
        orch_after = SystemOrchestrator(next_ir).run()
        score_after = _issue_score(
            sem_after,
            list(orch_after.get("consistency_errors", [])),
            plan_after,
            exec_result,
        )
        current = next_ir
        last_score = score_after

        if score_after >= score_before:
            break

    if first_score is None:
        first_score = 0.0
    denom = max(first_score, 1e-9)
    improvement = max(0.0, min(1.0, (first_score - last_score) / denom))
    report = {
        "iterations": iterations_run,
        "mutations_applied": applied,
        "improvement_score": round(improvement, 4),
    }
    return current, report

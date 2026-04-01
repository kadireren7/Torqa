from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.ir.canonical_ir import (
    IRCall,
    IRCondition,
    IRGoal,
    IRIdentifier,
    IRInput,
    IRStringLiteral,
    IRTransition,
    normalize_ir_goal,
    validate_ir,
)
from src.execution.ir_execution import IRExecutionContext, default_ir_runtime_impls, execute_ir_goal
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.projection.projection_strategy import ProjectionContext, ProjectionPlan, choose_projection_targets
from src.codegen.ir_to_projection import ir_goal_python_projection, ir_goal_rust_projection
from src.orchestrator.system_orchestrator import SystemOrchestrator


def _goal_semantic_validation() -> IRGoal:
    return normalize_ir_goal(
        IRGoal(
            goal="InternalSemanticValidation",
            inputs=[IRInput("ir_payload", "text"), IRInput("schema_version", "text")],
            preconditions=[
                IRCondition(
                    "c_req_0001",
                    "require",
                    IRCall("exists", [IRIdentifier("ir_payload", semantic_type="text")]),
                ),
                IRCondition(
                    "c_req_0002",
                    "require",
                    IRCall("exists", [IRIdentifier("schema_version", semantic_type="text")]),
                ),
            ],
            forbids=[],
            transitions=[
                IRTransition(
                    "t_0001",
                    "log_successful_login",
                    [IRIdentifier("schema_version"), IRStringLiteral("semantic_pass")],
                    "before",
                    "after",
                )
            ],
            postconditions=[],
            result="internal_semantic_validation_ready",
            metadata={"source": "python_prototype"},
        )
    )


def _goal_execution_planning() -> IRGoal:
    return normalize_ir_goal(
        IRGoal(
            goal="InternalExecutionPlanning",
            inputs=[IRInput("plan_request", "text"), IRInput("priority", "text")],
            preconditions=[
                IRCondition(
                    "c_req_0001",
                    "require",
                    IRCall("exists", [IRIdentifier("plan_request", semantic_type="text")]),
                )
            ],
            forbids=[],
            transitions=[
                IRTransition(
                    "t_0001",
                    "start_session",
                    [IRIdentifier("plan_request")],
                    "before",
                    "after",
                )
            ],
            postconditions=[],
            result="internal_execution_plan_ready",
            metadata={"source": "python_prototype"},
        )
    )


def _goal_projection_strategy() -> IRGoal:
    return normalize_ir_goal(
        IRGoal(
            goal="InternalProjectionStrategy",
            inputs=[IRInput("target_profile", "text"), IRInput("runtime_goal", "text")],
            preconditions=[
                IRCondition(
                    "c_req_0001",
                    "require",
                    IRCall("exists", [IRIdentifier("target_profile", semantic_type="text")]),
                )
            ],
            forbids=[],
            transitions=[
                IRTransition(
                    "t_0001",
                    "reset_failed_attempts",
                    [IRIdentifier("runtime_goal")],
                    "before",
                    "after",
                )
            ],
            postconditions=[],
            result="internal_projection_strategy_ready",
            metadata={"source": "python_prototype"},
        )
    )


def build_internal_ir_library() -> Dict[str, IRGoal]:
    return {
        "semantic_validation": _goal_semantic_validation(),
        "execution_planning": _goal_execution_planning(),
        "projection_strategy": _goal_projection_strategy(),
    }


def system_to_ir_description(system_manifest) -> IRGoal:
    caps = list((system_manifest or {}).get("capabilities", []))
    capability_count = str(len(caps))
    stage = str((system_manifest or {}).get("system_stage", "unknown"))
    return normalize_ir_goal(
        IRGoal(
            goal="SystemSelfDescription",
            inputs=[
                IRInput("system_stage", "text"),
                IRInput("source_of_truth", "text"),
                IRInput("capability_count", "text"),
            ],
            preconditions=[
                IRCondition(
                    "c_req_0001",
                    "require",
                    IRCall("exists", [IRIdentifier("system_stage", semantic_type="text")]),
                )
            ],
            forbids=[],
            transitions=[
                IRTransition(
                    "t_0001",
                    "log_successful_login",
                    [IRIdentifier("system_stage"), IRIdentifier("source_of_truth")],
                    "before",
                    "after",
                )
            ],
            postconditions=[],
            result=f"self_model_stage_{stage}_caps_{capability_count}",
            metadata={"source": "python_prototype"},
        )
    )


def validate_internal_ir_consistency(ir_library) -> List[str]:
    errors: List[str] = []
    required = {"semantic_validation", "execution_planning", "projection_strategy"}
    missing = required - set(ir_library.keys())
    if missing:
        errors.append(f"Internal IR library missing required goals: {sorted(missing)}")
    reg = default_ir_function_registry()
    for key, goal in sorted(ir_library.items()):
        verr = validate_ir(goal)
        if verr:
            errors.extend([f"{key}: {e}" for e in verr])
        sem = build_ir_semantic_report(goal, reg)
        if sem.get("errors"):
            errors.extend([f"{key}: {e}" for e in sem["errors"]])
    return errors


def project_internal_ir_library(ir_library: Dict[str, IRGoal]) -> Dict[str, Any]:
    projections: Dict[str, Any] = {}
    for key, goal in sorted(ir_library.items()):
        orch = SystemOrchestrator(goal, ProjectionContext(allow_multiple_targets=True)).run()
        rust_stub = {
            "target_language": "rust",
            "purpose": "core_runtime",
            "files": [
                {
                    "filename": f"generated/internal/{key}/rust/main.rs",
                    "content": ir_goal_rust_projection(goal),
                }
            ],
        }
        py_stub = {
            "target_language": "python",
            "purpose": "tooling_bridge",
            "files": [
                {
                    "filename": f"generated/internal/{key}/python/main.py",
                    "content": ir_goal_python_projection(goal),
                }
            ],
        }
        projections[key] = {
            "projection_plan": {
                "primary": orch["projection_plan"].primary_target.language,
                "secondary": [t.language for t in orch["projection_plan"].secondary_targets],
            },
            "artifacts": [rust_stub, py_stub],
        }
    return projections


def execute_internal_ir_library(ir_library: Dict[str, IRGoal]) -> Dict[str, Any]:
    reg = default_ir_function_registry()
    runtime = default_ir_runtime_impls()
    out: Dict[str, Any] = {}
    for key, goal in sorted(ir_library.items()):
        demo_inputs = {inp.name: f"{key}_{inp.name}" for inp in goal.inputs}
        result, plan = execute_ir_goal(goal, IRExecutionContext(demo_inputs, {}), reg, runtime)
        out[key] = {
            "success": result.success,
            "errors": list(result.errors),
            "executed_transitions": list(result.executed_transitions),
            "step_count": len(plan.steps),
        }
    return out

"""
V6.1 headless editor architecture: canonical IR only (no parser AST).

Architecture rule: application code must not mutate generated projection files directly.
All edits flow: user action → editor session → IR mutation → validation → previews →
regenerated outputs (outside this module).
"""

from __future__ import annotations

import copy
import json
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from src.ir.canonical_ir import (
    IRGoal,
    compute_ir_fingerprint,
    ir_goal_from_json,
    ir_goal_to_json,
    normalize_ir_goal,
)
from src.control.control_layer import MutationPolicy
from src.editor.ir_edit_engine import IREditOperation, IREditTransaction, apply_edit_transaction
from src.execution.ir_execution import (
    IRExecutionContext,
    default_ir_runtime_impls,
    execute_ir_goal,
    ir_execution_plan_to_json,
    ir_execution_result_to_json,
)
from src.control.ir_mutation import compute_ir_diff
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.projection.projection_graph import build_projection_graph, projection_graph_to_json
from src.projection.projection_strategy import ProjectionContext, choose_projection_targets, projection_plan_to_json
from src.bridge.rust_bridge import rust_execute_ir, rust_semantic_report

EDITOR_CONTRACT_VERSION = "6.1"
ALLOWED_DIAGNOSTIC_SEVERITIES = frozenset({"error", "warning", "info"})


class EditorDiagnostic:
    def __init__(
        self,
        severity: str,
        message: str,
        related_ids: Optional[List[str]] = None,
        suggested_fixes: Optional[List[Dict[str, Any]]] = None,
    ):
        if severity not in ALLOWED_DIAGNOSTIC_SEVERITIES:
            raise ValueError(f"severity must be one of {sorted(ALLOWED_DIAGNOSTIC_SEVERITIES)}")
        self.severity = severity
        self.message = message
        self.related_ids = list(related_ids or [])
        self.suggested_fixes = list(suggested_fixes or [])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity,
            "message": self.message,
            "related_ids": list(self.related_ids),
            "suggested_fixes": list(self.suggested_fixes),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> EditorDiagnostic:
        return cls(
            severity=str(d["severity"]),
            message=str(d["message"]),
            related_ids=list(d.get("related_ids") or []),
            suggested_fixes=list(d.get("suggested_fixes") or []),
        )


class EditorOperation:
    """
    Stable app-facing edit contract. Maps to ir_edit_engine.IREditOperation.
    """

    def __init__(
        self,
        op_type: str,
        target_path: str,
        payload: Optional[Dict[str, Any]] = None,
        operation_id: Optional[str] = None,
        editor_metadata: Optional[Dict[str, Any]] = None,
    ):
        self.op_type = op_type
        self.target_path = target_path or ""
        self.payload = dict(payload or {})
        self.operation_id = operation_id or str(uuid.uuid4())
        self.editor_metadata = dict(editor_metadata or {})

    def to_iredit(self) -> IREditOperation:
        return IREditOperation(
            self.op_type,
            self.target_path,
            self.payload,
            operation_id=self.operation_id,
            editor_metadata=self.editor_metadata,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation_id": self.operation_id,
            "op_type": self.op_type,
            "target_path": self.target_path,
            "payload": dict(sorted(self.payload.items())) if self.payload else {},
            "editor_metadata": dict(sorted(self.editor_metadata.items())) if self.editor_metadata else {},
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> EditorOperation:
        return cls(
            op_type=str(d["op_type"]),
            target_path=str(d.get("target_path") or ""),
            payload=dict(d.get("payload") or {}),
            operation_id=d.get("operation_id"),
            editor_metadata=dict(d.get("editor_metadata") or {}),
        )


class EditorSession:
    def __init__(
        self,
        ir_goal: IRGoal,
        engine_mode: str = "rust_preferred",
        *,
        mutation_policy: Optional[MutationPolicy] = None,
        projection_context: Optional[ProjectionContext] = None,
        demo_inputs: Optional[Dict[str, Any]] = None,
    ):
        self.ir_goal = normalize_ir_goal(copy.deepcopy(ir_goal))
        self.engine_mode = engine_mode
        self.mutation_policy = mutation_policy or MutationPolicy()
        self.projection_context = projection_context or ProjectionContext()
        self.demo_inputs = dict(demo_inputs or {})

        self._undo_stack: List[IRGoal] = []
        self._redo_stack: List[IRGoal] = []

        self.pending_diagnostics: List[EditorDiagnostic] = []
        self.last_semantic_report: Dict[str, Any] = {}
        self.last_rust_semantic: Optional[Dict[str, Any]] = None
        self.last_projection_plan: Optional[Any] = None
        self.last_projection_graph_json: Optional[Dict[str, Any]] = None
        self.last_execution_preview: Dict[str, Any] = {}
        self.last_edit_report: Dict[str, Any] = {}
        self.last_diff: Dict[str, Any] = {}
        self.last_validation_ok: bool = True
        self.last_successful_fingerprint: Optional[str] = None
        self.dirty: bool = False

        _refresh_previews(self)

    @property
    def history(self) -> Dict[str, Any]:
        return {
            "undo_depth": len(self._undo_stack),
            "redo_depth": len(self._redo_stack),
        }


def _errors_to_diagnostics(
    errors: Sequence[str],
    severity: str = "error",
    related_ids: Optional[List[str]] = None,
) -> List[EditorDiagnostic]:
    return [
        EditorDiagnostic(severity, msg, related_ids=related_ids)
        for msg in errors
    ]


def _refresh_previews(session: EditorSession) -> None:
    reg = default_ir_function_registry()
    session.last_semantic_report = build_ir_semantic_report(session.ir_goal, reg)

    session.last_rust_semantic = None
    if session.engine_mode != "python_only":
        env = ir_goal_to_json(session.ir_goal)
        rust_resp = rust_semantic_report(env)
        if rust_resp.get("ok"):
            session.last_rust_semantic = rust_resp.get("result") or {}
        else:
            session.pending_diagnostics.append(
                EditorDiagnostic(
                    "warning",
                    "Rust semantic engine unavailable or failed; using Python semantic report only.",
                    suggested_fixes=[],
                )
            )

    exec_summary = (
        session.last_execution_preview.get("execution_result")
        if isinstance(session.last_execution_preview, dict)
        else None
    )
    if not isinstance(exec_summary, dict):
        exec_summary = None

    session.last_projection_plan = choose_projection_targets(
        session.ir_goal,
        session.last_semantic_report,
        execution_summary=exec_summary,
        context=session.projection_context,
    )
    graph = build_projection_graph(session.ir_goal, session.last_projection_plan)
    session.last_projection_graph_json = projection_graph_to_json(graph)

    _run_execution_preview(session)

    session.pending_diagnostics = _merge_editor_diagnostics(session)


def _run_execution_preview(session: EditorSession) -> None:
    reg = default_ir_function_registry()
    ctx = IRExecutionContext(inputs=dict(session.demo_inputs), world_state={})
    preview: Dict[str, Any] = {
        "engine": "python",
        "execution_plan": {},
        "execution_result": {},
    }

    if session.engine_mode in {"rust_preferred", "rust_only"}:
        env = ir_goal_to_json(session.ir_goal)
        bridge_ctx = {"inputs": dict(session.demo_inputs), "world_state": {}}
        rust_resp = rust_execute_ir(env, bridge_ctx)
        if rust_resp.get("ok"):
            res = rust_resp.get("result") or {}
            ex = res.get("execution_result")
            if isinstance(ex, dict):
                preview = {
                    "engine": "rust",
                    "execution_plan": res.get("execution_plan"),
                    "execution_result": ex,
                }
                session.last_execution_preview = preview
                return
        if session.engine_mode == "rust_only":
            session.last_execution_preview = {
                "engine": "rust",
                "execution_plan": None,
                "execution_result": {"success": False, "errors": ["rust_execute_ir failed"]},
            }
            return

    ir_exec_result, ir_plan = execute_ir_goal(
        session.ir_goal, ctx, reg, default_ir_runtime_impls()
    )
    preview = {
        "engine": "python",
        "execution_plan": ir_execution_plan_to_json(ir_plan),
        "execution_result": ir_execution_result_to_json(ir_exec_result),
    }
    session.last_execution_preview = preview


def _merge_editor_diagnostics(session: EditorSession) -> List[EditorDiagnostic]:
    out: List[EditorDiagnostic] = []

    sem = session.last_semantic_report
    for e in sem.get("errors") or []:
        out.append(
            EditorDiagnostic(
                "error",
                str(e),
                suggested_fixes=[{"op_type": "update_expr", "target_path": "", "payload": {}}],
            )
        )
    for w in sem.get("warnings") or []:
        out.append(EditorDiagnostic("warning", str(w)))

    rust = session.last_rust_semantic
    if isinstance(rust, dict):
        for e in rust.get("semantic_errors") or []:
            out.append(EditorDiagnostic("error", f"[rust] {e}"))
        for w in rust.get("semantic_warnings") or []:
            out.append(EditorDiagnostic("warning", f"[rust] {w}"))
        if rust.get("validation_errors"):
            for e in rust["validation_errors"]:
                out.append(EditorDiagnostic("error", f"[rust validation] {e}"))

    if not sem.get("semantic_ok", False):
        session.last_validation_ok = False
    else:
        ve = rust.get("validation_errors") if isinstance(rust, dict) else None
        se = rust.get("semantic_errors") if isinstance(rust, dict) else None
        rust_ok = rust is None or (
            isinstance(rust, dict)
            and not (ve or se)
            and rust.get("ir_valid", True) is not False
        )
        session.last_validation_ok = bool(rust_ok)

    return out


def create_editor_session(
    ir_goal: IRGoal,
    engine_mode: str = "rust_preferred",
    **kwargs: Any,
) -> EditorSession:
    return EditorSession(ir_goal, engine_mode=engine_mode, **kwargs)


def apply_editor_operations(
    session: EditorSession,
    operations: Sequence[Union[EditorOperation, IREditOperation]],
) -> Dict[str, Any]:
    irops: List[IREditOperation] = []
    for op in operations:
        if isinstance(op, EditorOperation):
            irops.append(op.to_iredit())
        else:
            irops.append(op)

    tx = IREditTransaction(irops)
    before = normalize_ir_goal(copy.deepcopy(session.ir_goal))
    new_ir, report = apply_edit_transaction(session.ir_goal, tx)

    result: Dict[str, Any] = {
        "committed": report.get("status") == "committed",
        "report": report,
        "diagnostics": [],
    }

    if report.get("status") == "committed":
        session._undo_stack.append(before)
        session._redo_stack.clear()
        session.ir_goal = normalize_ir_goal(new_ir)
        session.last_edit_report = report
        session.last_diff = report.get("diff") or {}
        session.last_successful_fingerprint = report.get("fingerprint_after")
        session.dirty = True
        session.last_validation_ok = True
        _refresh_previews(session)
        for w in report.get("warnings") or []:
            session.pending_diagnostics.append(EditorDiagnostic("warning", str(w)))
        result["diagnostics"] = [d.to_dict() for d in session.pending_diagnostics]
        return result

    session.ir_goal = before
    session.last_edit_report = report
    session.last_diff = report.get("diff") or {}
    errs = report.get("errors") or []
    session.pending_diagnostics = _errors_to_diagnostics(errs, "error")
    session.last_validation_ok = False
    _refresh_previews(session)
    result["diagnostics"] = [d.to_dict() for d in session.pending_diagnostics]
    return result


def preview_editor_state(session: EditorSession) -> Dict[str, Any]:
    _refresh_previews(session)
    return {
        "semantic_preview": {
            "python": session.last_semantic_report,
            "rust": session.last_rust_semantic,
        },
        "execution_preview": session.last_execution_preview,
        "projection_strategy_preview": projection_plan_to_json(session.last_projection_plan)[
            "projection_plan"
        ]
        if session.last_projection_plan
        else {},
        "projection_graph_preview": session.last_projection_graph_json or {},
        "last_diff": session.last_diff,
        "fingerprint": compute_ir_fingerprint(session.ir_goal),
        "validation_ok": session.last_validation_ok,
    }


def undo_editor_change(session: EditorSession) -> Dict[str, Any]:
    if not session._undo_stack:
        return {"ok": False, "reason": "Nothing to undo."}
    session._redo_stack.append(normalize_ir_goal(copy.deepcopy(session.ir_goal)))
    session.ir_goal = normalize_ir_goal(copy.deepcopy(session._undo_stack.pop()))
    session.dirty = True
    _refresh_previews(session)
    return {"ok": True, "history": session.history}


def redo_editor_change(session: EditorSession) -> Dict[str, Any]:
    if not session._redo_stack:
        return {"ok": False, "reason": "Nothing to redo."}
    session._undo_stack.append(normalize_ir_goal(copy.deepcopy(session.ir_goal)))
    session.ir_goal = normalize_ir_goal(copy.deepcopy(session._redo_stack.pop()))
    session.dirty = True
    _refresh_previews(session)
    return {"ok": True, "history": session.history}


def get_editor_diagnostics(session: EditorSession) -> List[Dict[str, Any]]:
    return [d.to_dict() for d in session.pending_diagnostics]


def build_editor_views(session: EditorSession) -> Dict[str, Any]:
    _refresh_previews(session)
    ig = ir_goal_to_json(session.ir_goal)["ir_goal"]
    sem = session.last_semantic_report

    intent_view = {
        "goal": ig.get("goal"),
        "result": ig.get("result"),
        "input_names": [i["name"] for i in ig.get("inputs", [])],
        "transition_effect_names": [t["effect_name"] for t in ig.get("transitions", [])],
    }

    rule_view = {
        "preconditions": ig.get("preconditions", []),
        "forbids": ig.get("forbids", []),
        "postconditions": ig.get("postconditions", []),
        "guarantee_table": sem.get("guarantee_table", {}),
    }

    graph_view = session.last_projection_graph_json or {}

    execution_view = {
        "plan": session.last_execution_preview.get("execution_plan"),
        "result": session.last_execution_preview.get("execution_result"),
        "engine": session.last_execution_preview.get("engine"),
    }

    artifacts_view = {
        "projection_plan": projection_plan_to_json(session.last_projection_plan)["projection_plan"]
        if session.last_projection_plan
        else {},
        "note": "Stub artifacts are produced by system orchestrator after IR commit; editor exposes plan only.",
    }

    diagnostics_view = {
        "items": get_editor_diagnostics(session),
        "validation_ok": session.last_validation_ok,
        "semantic_ok": bool(sem.get("semantic_ok")),
    }

    return {
        "intent_view": intent_view,
        "rule_view": rule_view,
        "graph_view": graph_view,
        "execution_view": execution_view,
        "artifacts_view": artifacts_view,
        "diagnostics_view": diagnostics_view,
    }


def get_editor_views(session: EditorSession) -> Dict[str, Any]:
    return build_editor_views(session)


def save_editor_session(session: EditorSession) -> Dict[str, Any]:
    def snap(g: IRGoal) -> Dict[str, Any]:
        return ir_goal_to_json(normalize_ir_goal(g))["ir_goal"]

    diagnostics_snapshot = [d.to_dict() for d in session.pending_diagnostics]
    payload = {
        "editor_contract_version": EDITOR_CONTRACT_VERSION,
        "engine_mode": session.engine_mode,
        "ir_goal": snap(session.ir_goal),
        "history": {
            "undo_stack": [snap(g) for g in session._undo_stack],
            "redo_stack": [snap(g) for g in session._redo_stack],
        },
        "diagnostics_snapshot": diagnostics_snapshot,
        "demo_inputs": dict(sorted(session.demo_inputs.items())),
        "last_successful_fingerprint": session.last_successful_fingerprint,
        "dirty": session.dirty,
    }
    session.dirty = False
    return payload


def load_editor_session(data: Dict[str, Any]) -> EditorSession:
    ir_goal = ir_goal_from_json({"ir_goal": data["ir_goal"]})
    engine_mode = str(data.get("engine_mode") or "rust_preferred")
    demo_inputs = dict(data.get("demo_inputs") or {})

    session = EditorSession(ir_goal, engine_mode=engine_mode, demo_inputs=demo_inputs)

    hist = data.get("history") or {}
    session._undo_stack = [
        normalize_ir_goal(ir_goal_from_json({"ir_goal": g})) for g in hist.get("undo_stack", [])
    ]
    session._redo_stack = [
        normalize_ir_goal(ir_goal_from_json({"ir_goal": g})) for g in hist.get("redo_stack", [])
    ]

    session.pending_diagnostics = [
        EditorDiagnostic.from_dict(d) for d in (data.get("diagnostics_snapshot") or [])
    ]
    session.last_successful_fingerprint = data.get("last_successful_fingerprint")
    session.dirty = bool(data.get("dirty", False))
    _refresh_previews(session)
    return session


def save_editor_session_json(session: EditorSession) -> str:
    return json.dumps(save_editor_session(session), ensure_ascii=False, sort_keys=True, allow_nan=False)


def load_editor_session_json(text: str) -> EditorSession:
    return load_editor_session(json.loads(text))

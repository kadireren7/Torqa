import json
from pathlib import Path

from src.ir.canonical_ir import ir_goal_from_json
from src.execution.trace_pack import build_execution_trace_for_run, enrich_execution_step_dict

REPO = Path(__file__).resolve().parents[1]


def test_enrich_transition_step():
    raw = json.loads((REPO / "examples/core/valid_start_session_flow.json").read_text(encoding="utf-8"))
    g = ir_goal_from_json(raw)
    row = enrich_execution_step_dict(
        g,
        {"step_id": "s_0002", "kind": "transition", "ref_id": "t_0001", "status": "executed"},
    )
    assert row["summary"] == "Transition t_0001 → effect start_session"
    assert row["effect_name"] == "start_session"


def test_trace_python_fallback_shape():
    raw = json.loads((REPO / "examples/core/valid_minimal_flow.json").read_text(encoding="utf-8"))
    g = ir_goal_from_json(raw)
    fb = {
        "used": True,
        "reason": "test",
        "python_result": {
            "execution": {
                "execution_plan": {
                    "steps": [
                        {
                            "step_id": "s_0001",
                            "kind": "precondition",
                            "ref_id": "c_req_0001",
                            "status": "passed",
                        }
                    ]
                },
                "execution_result": {"success": True},
            }
        },
    }
    tr = build_execution_trace_for_run(g, {}, fb)
    assert tr["source"] == "python_fallback"
    assert tr["plan"]["steps"][0]["summary"] == "Precondition c_req_0001"

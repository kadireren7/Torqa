"""P128: company-grade operations modeling in structured plans and benchmarks."""

from __future__ import annotations

from pathlib import Path

from src.ai.tq_company_ops import (
    build_company_operations_model,
    company_grade_plan_applies,
    merge_company_ops_into_domain_plan,
)
from src.ai.tq_domain import build_domain_plan
from src.ai.tq_intent import resolve_tq_gen_intent
from src.ai.tq_plan import infer_surface_kind
from src.ai.tq_structured_plan import build_structured_generation_plan
from src.benchmarks.benchmark_initial import discover_benchmark_task_dirs
from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.surface.parse_tq import parse_tq_source

REPO = Path(__file__).resolve().parents[1]


def test_company_grade_plan_applies_for_approvals_and_workflow_surface() -> None:
    assert company_grade_plan_applies("approvals", "workflow", "workflow_system") is True
    assert company_grade_plan_applies("auth", "app", "product_web_app") is False


def test_structured_plan_includes_company_operations_model_for_dashboard() -> None:
    p = "Executive KPI dashboard with filters and drilldown for ops review"
    intent = resolve_tq_gen_intent(p, None)
    surf = infer_surface_kind(p)
    plan = build_structured_generation_plan(p, intent, surf)
    assert plan.get("company_operations_model") is not None
    co = plan["company_operations_model"]
    assert co["version"] == 1
    assert "workflow_modeling" in co
    assert plan["domain_plan"].get("company_operations_p128", {}).get("applies") is True


def test_structured_plan_omits_company_ops_for_pure_auth() -> None:
    plan = build_structured_generation_plan("Sign in with password", "auth", "app")
    assert plan.get("company_operations_model") is None


def test_requires_hints_p128_approvals_richer_defaults() -> None:
    p = "Multi-stage purchase order approval chain with SLA"
    intent = resolve_tq_gen_intent(p, None)
    surf = infer_surface_kind(p)
    plan = build_structured_generation_plan(p, intent, surf)
    ro = plan["requires_hints"].get("recommended_order") or []
    assert "escalation_tier" in ro
    assert "rejection_code" in ro


def test_build_company_operations_model_has_entity_and_ops_axes() -> None:
    m = build_company_operations_model("crm", "app", "product_web_app")
    assert any("escalation" in s.lower() for s in m["workflow_modeling"]["axes"])
    ents = m["business_entities"]["model_as_requires"]
    assert any("notification" in e for e in ents)


def test_p128_benchmark_surfaces_validate() -> None:
    root = REPO / "examples" / "benchmarks"
    for name in (
        "company_service_request_queue",
        "company_crm_handoff_console",
        "company_internal_ops_dashboard",
        "company_document_processing_pipeline",
    ):
        assert (root / name / "TASK.md").is_file()
        tq_path = root / name / "app.tq"
        bundle = parse_tq_source(tq_path.read_text(encoding="utf-8"), tq_path=tq_path)
        goal = ir_goal_from_json(bundle)
        rep = build_full_diagnostic_report(goal)
        assert rep.get("ok") is True, (name, rep.get("issues"))


def test_discover_includes_p128_benchmark_dirs() -> None:
    dirs = discover_benchmark_task_dirs(REPO / "examples" / "benchmarks")
    assert any(d.name == "company_service_request_queue" for d in dirs)


def test_merge_company_ops_into_domain_plan_sets_p128_flag() -> None:
    base = build_domain_plan("data_pipeline", "automation", "data_pipeline", [])
    merged = merge_company_ops_into_domain_plan(base, "automation", "data_pipeline", "data_pipeline")
    assert merged.get("company_operations_p128", {}).get("applies") is True


def test_structured_plan_company_ops_for_document_pipeline_prompt() -> None:
    p = (
        "Regulated document intake: OCR queue, human review stage, retention policy, "
        "audit trail correlation across ingest and archive sink"
    )
    intent = resolve_tq_gen_intent(p, None)
    surf = infer_surface_kind(p)
    plan = build_structured_generation_plan(p, intent, surf)
    assert plan.get("company_operations_model") is not None
    assert plan["domain_plan"].get("company_operations_p128", {}).get("applies") is True

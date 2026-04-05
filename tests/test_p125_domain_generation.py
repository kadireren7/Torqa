"""P125: domain classification and planning for .tq generation."""

from __future__ import annotations

import json

from src.ai.tq_domain import build_domain_plan, domain_planning_one_liner, infer_product_domain
from src.ai.tq_plan import infer_surface_kind
from src.ai.tq_structured_plan import build_structured_generation_plan
from src.ai.tq_intent import resolve_tq_gen_intent


def test_infer_surface_data_pipeline() -> None:
    assert infer_surface_kind("Build an ETL from Postgres to Snowflake with CDC") == "data_pipeline"
    assert infer_surface_kind("Kafka ingest with dead letter queue and replay") == "data_pipeline"


def test_infer_product_domain_major_categories() -> None:
    # Marketing
    d = infer_product_domain("Hero waitlist landing with newsletter CTA", "website", "landing")
    assert d == "marketing_site"
    # Product app
    d = infer_product_domain("React SPA sign-in and settings screens", "app", "auth")
    assert d == "product_web_app"
    # Admin / dashboard
    d = infer_product_domain("Internal admin console for support agents", "app", "crud")
    assert d == "admin_dashboard"
    d = infer_product_domain("Executive KPI dashboard with filters", "dashboard", "dashboard")
    assert d == "admin_dashboard"
    # Workflow
    d = infer_product_domain("Multi-stage purchase order approval chain", "workflow", "approvals")
    assert d == "workflow_system"
    # Automation
    d = infer_product_domain("Webhook triggered worker with retries", "automation", "automation")
    assert d == "automation_system"
    # Data pipeline
    d = infer_product_domain("Route events from bus to warehouse with transforms", "data_pipeline", "automation")
    assert d == "data_pipeline"


def test_domain_plan_has_distinct_emit_expectations() -> None:
    domains = [
        ("marketing_site", "landing"),
        ("product_web_app", "auth"),
        ("admin_dashboard", "dashboard"),
        ("workflow_system", "approvals"),
        ("automation_system", "automation"),
        ("data_pipeline", "automation"),
    ]
    layouts = set()
    for dom, prof in domains:
        plan = build_domain_plan(dom, prof, "generic", [])  # type: ignore[arg-type]
        exp = plan.get("emit_expectations") or {}
        layouts.add(str(exp.get("layout")))
        assert domain_planning_one_liner(dom)
    assert len(layouts) >= 5


def test_structured_plan_includes_domain_and_requires_differ() -> None:
    prompt_m = "Marketing landing page with hero and email capture"
    intent_m = resolve_tq_gen_intent(prompt_m, None)
    surf_m = infer_surface_kind(prompt_m)
    plan_m = build_structured_generation_plan(prompt_m, intent_m, surf_m)
    assert plan_m.get("product_domain") == "marketing_site"
    assert "domain_plan" in plan_m and plan_m["domain_plan"].get("emit_expectations")

    prompt_d = "Stream processing pipeline: ingest, map fields, route to sink"
    intent_d = resolve_tq_gen_intent(prompt_d, None)
    surf_d = infer_surface_kind(prompt_d)
    plan_d = build_structured_generation_plan(prompt_d, intent_d, surf_d)
    assert plan_d.get("product_domain") == "data_pipeline"
    assert plan_d["requires_hints"].get("note") == "source_transform_sink_lineage"

    blob_m = json.dumps(plan_m, sort_keys=True)
    blob_d = json.dumps(plan_d, sort_keys=True)
    assert blob_m != blob_d


def test_nl_plan_lists_product_domain() -> None:
    from src.ai.tq_plan import build_nl_plan, format_nl_plan_markdown

    p = "Internal ops dashboard for inventory metrics"
    intent = resolve_tq_gen_intent(p, None)
    surf = infer_surface_kind(p)
    nl = build_nl_plan(p, intent, surf)
    assert nl.get("product_domain") == "admin_dashboard"
    md = format_nl_plan_markdown(nl)
    assert "Product domain (P125)" in md
    assert "admin_dashboard" in md

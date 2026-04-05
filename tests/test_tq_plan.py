"""P109: surface kind + NL plan formatting."""

from __future__ import annotations

from src.ai.tq_plan import (
    build_nl_plan,
    format_nl_plan_markdown,
    infer_surface_kind,
)
from src.ai.tq_intent import build_structured_user_message, classify_tq_gen_intent


def test_infer_surface_website():
    assert infer_surface_kind("Marketing landing page with hero and email capture") == "website"


def test_infer_surface_app_login():
    assert infer_surface_kind("Web app with sign-in and password") == "app"


def test_infer_surface_dashboard():
    assert infer_surface_kind("Executive dashboard with KPI tiles") == "dashboard"


def test_infer_surface_workflow():
    assert infer_surface_kind("Multi-step approval with human review") == "workflow"


def test_infer_surface_automation_webhook():
    assert infer_surface_kind("Webhook trigger that enqueues a background job") == "automation"


def test_plan_includes_entities_and_is_prefixed_in_user_message():
    intent = classify_tq_gen_intent("Track order_id and customer email for shipment webhook")
    surface = infer_surface_kind("Track order_id and customer email for shipment webhook")
    plan = build_nl_plan("Track order_id and customer email for shipment webhook", intent, surface)
    md = format_nl_plan_markdown(plan)
    assert "order" in md.lower() or "email" in md.lower()
    assert "Surface kind" in md
    full = build_structured_user_message(
        "Track order_id and customer email for shipment webhook",
        intent,
        nl_plan_markdown=md,
    )
    assert "Inferred request" in full
    assert "## Generation profile" in full

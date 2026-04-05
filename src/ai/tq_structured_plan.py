"""
P113: Machine-checkable structured plan (prompt → plan → .tq).

Serialized into the user message so the model aligns output and hallucinates fewer fields.
All deterministic — no extra LLM call.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, cast

from src.ai.tq_intent import TqGenIntent, normalize_prompt_text
from src.ai.tq_company_ops import (
    build_company_operations_model,
    company_grade_plan_applies,
    merge_company_ops_into_domain_plan,
)
from src.ai.tq_domain import ProductDomain, build_domain_plan, infer_product_domain
from src.ai.tq_plan import SurfaceKind, build_nl_plan


def _login_success_explicit(norm: str) -> bool:
    t = norm.lower()
    if not t.strip():
        return False
    if re.search(
        r"\b(sign[\s-]?in|log[\s-]?in|login|successful\s+login|session|authenticate)\b",
        t,
        re.I,
    ):
        if re.search(r"\b(form|ui|page|mockup|wireframe|layout)\b", t, re.I) and not re.search(
            r"\b(password|credential|jwt|token|sso)\b", t, re.I
        ):
            return False
        return True
    return False


def _intent_slug(norm: str, profile: TqGenIntent) -> str:
    base = norm.lower()
    base = re.sub(r"[^a-z0-9\s_]+", " ", base)
    words = [w for w in base.split() if len(w) > 1][:4]
    if not words:
        return {
            "auth": "user_sign_in",
            "landing": "marketing_landing",
            "crud": "resource_admin",
            "automation": "workflow_run",
            "crm": "account_pipeline_view",
            "onboarding": "user_onboarding_journey",
            "approvals": "approval_decision_flow",
            "dashboard": "metrics_dashboard_shell",
            "generic": "user_request_flow",
        }[profile]
    slug = "_".join(words)[:48].strip("_")
    return slug or "user_flow"


def _requires_hints(
    profile: TqGenIntent,
    surface: SurfaceKind,
    entities: List[str],
    *,
    product_domain: str,
) -> Dict[str, Any]:
    ent = [str(e).strip() for e in (entities or []) if str(e).strip().isidentifier()][:10]
    if profile == "auth":
        base = ["username", "password"]
        if any("email" in x.lower() for x in ent):
            base = ["email", "password"]
        if any(x in ("ip", "ip_address", "audit") for x in ent):
            base = [*base, "ip_address"] if "ip_address" not in base else base
        return {"recommended_order": base, "must_be_comma_separated": True}
    if profile == "landing":
        pick = next((x for x in ent if x.lower() in ("email", "lead_email", "visitor_email")), None)
        return {
            "recommended_order": [pick or "email"],
            "avoid_password_unless_user_asked": True,
        }
    # P125: data movement beats generic automation profile when both apply.
    if product_domain == "data_pipeline":
        ro = ent[:10] if ent else ["source_cursor", "transform_version", "route_key", "sink_target", "batch_id"]
        return {"recommended_order": ro, "note": "source_transform_sink_lineage"}
    if profile == "crud":
        head = next(
            (
                x
                for x in ent
                if x.lower()
                in (
                    "product_id",
                    "order_id",
                    "customer_id",
                    "record_id",
                    "ticket_id",
                    "user_id",
                )
            ),
            None,
        )
        rest = [x for x in ent if x != head][:6]
        ro = ([head] if head else ["record_id"]) + rest
        return {"recommended_order": ro, "note": "resource key first, then attributes"}
    if profile == "automation":
        ro = ent[:8] if ent else ["run_id", "case_id"]
        return {"recommended_order": ro}
    if profile == "crm":
        head = next(
            (
                x
                for x in ent
                if x.lower()
                in (
                    "account_id",
                    "contact_id",
                    "deal_id",
                    "opportunity_id",
                    "lead_id",
                )
            ),
            None,
        )
        rest = [x for x in ent if x != head][:7]
        ro = ([head] if head else ["account_id", "contact_id", "deal_stage", "owner_id"]) + rest
        return {
            "recommended_order": ro[:12],
            "note": "P128: pipeline_tasks_notifications_handoffs_four_plus_fields",
        }
    if profile == "onboarding":
        base = [
            "user_id",
            "onboarding_step",
            "journey_variant",
            "completion_pct",
            "provisioning_queue_id",
            "audit_event_id",
        ]
        extra = [x for x in ent if x not in base][:6]
        return {
            "recommended_order": (base + extra)[:12],
            "note": "P128: wizard_stages_audit_handoff_to_provisioning",
        }
    if profile == "approvals":
        base = [
            "request_id",
            "approver_id",
            "policy_tier",
            "sla_deadline_at",
            "case_status",
            "escalation_tier",
            "rejection_code",
            "correlation_id",
        ]
        extra = [x for x in ent if x not in base][:6]
        return {
            "recommended_order": (base + extra)[:12],
            "note": "P128: approvals_matrix_escalation_rejection_handles; include_flow_when_session_backed_review",
        }
    if profile == "dashboard":
        base = [
            "report_id",
            "metric_key",
            "time_range",
            "dimension",
            "drilldown_entity_id",
            "comparison_window",
            "export_job_id",
        ]
        extra = [x for x in ent if x not in base][:6]
        return {
            "recommended_order": (base + extra)[:12],
            "note": "P128: ops_command_center_filters_kpi_drilldown_export",
        }
    # P125: domain nudges after explicit profile rows (do not override auth/landing/approvals).
    if product_domain == "workflow_system" and profile not in ("approvals", "auth"):
        ro = (
            ent[:12]
            if ent
            else [
                "case_id",
                "request_id",
                "actor_id",
                "stage_code",
                "escalation_tier",
                "correlation_id",
                "decision_outcome",
            ]
        )
        return {"recommended_order": ro, "note": "P128: workflow_case_actors_escalation_correlation"}
    if product_domain == "marketing_site" and profile == "generic":
        pick = next((x for x in ent if "email" in x.lower()), None)
        ro = [pick, "lead_source"] if pick else ["email", "lead_source"]
        return {
            "recommended_order": ro,
            "avoid_password_unless_user_asked": True,
            "note": "marketing_capture_first",
        }
    return {"recommended_order": ent[:6] if ent else ["username", "password"]}


def build_structured_generation_plan(
    raw_prompt: str,
    intent: TqGenIntent,
    surface: SurfaceKind,
) -> Dict[str, Any]:
    norm = normalize_prompt_text(raw_prompt)
    nl = build_nl_plan(raw_prompt, intent, surface)
    raw_pd = nl.get("product_domain")
    if not isinstance(raw_pd, str) or not raw_pd:
        raw_pd = infer_product_domain(raw_prompt, surface, intent)
    product_domain: ProductDomain = cast(ProductDomain, raw_pd)
    domain_plan = build_domain_plan(product_domain, intent, surface, list(nl.get("entities_guess") or []))
    domain_plan = merge_company_ops_into_domain_plan(domain_plan, intent, surface, product_domain)
    co_model: Dict[str, Any] | None = None
    if company_grade_plan_applies(intent, surface, product_domain):
        co_model = build_company_operations_model(intent, surface, product_domain)
    session_ok = intent == "auth" and _login_success_explicit(norm)
    return {
        "version": 1,
        "intent_snake_case": _intent_slug(norm, intent),
        "generation_profile": intent,
        "surface_kind": surface,
        "product_domain": product_domain,
        "domain_plan": domain_plan,
        "company_operations_model": co_model,
        "requires_hints": _requires_hints(
            intent,
            surface,
            list(nl.get("entities_guess") or []),
            product_domain=str(product_domain),
        ),
        "session_flow_recommended": session_ok,
        "result_label_options": list(nl.get("likely_result_labels") or [])[:5],
        "output_contract": {
            "json_top_level_keys": ["tq"],
            "forbidden_top_level_keys": [
                "ir_goal",
                "markdown",
                "explanation",
                "notes",
                "reasoning",
                "file",
                "path",
                "thought",
            ],
            "tq_inside_string_only": True,
        },
    }


def format_structured_plan_block(plan: Dict[str, Any]) -> str:
    """Inject below NL plan markdown; model must follow."""
    blob = json.dumps(plan, ensure_ascii=False, sort_keys=True, indent=2)
    return (
        "## Structured plan (machine checklist — follow exactly)\n"
        "Obey this JSON when choosing `intent`, `requires`, `result`, and `flow:` shape. "
        "Do not invent identifiers outside the user request except where this plan lists "
        "recommended_order defaults.\n\n"
        f"```json\n{blob}\n```\n"
    )

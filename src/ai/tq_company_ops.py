"""
P128: Company-grade workflow and operations modeling guidance (planning layer only).

TORQA ``tq_v1`` syntax is unchanged: business richness is expressed through **dense ``requires``**,
**section ``#`` comments**, and **valid ``flow:`` steps** where session-backed operator UIs apply.
This module adds a machine checklist injected into the structured generation plan so outputs read as
internal tools, admin consoles, and process systems — not toy demos.
"""

from __future__ import annotations

from typing import Any, Dict, List

from src.ai.tq_domain import ProductDomain
from src.ai.tq_intent import TqGenIntent
from src.ai.tq_plan import SurfaceKind


def company_grade_plan_applies(
    intent: TqGenIntent,
    surface: SurfaceKind,
    product_domain: ProductDomain,
) -> bool:
    if intent in ("crm", "onboarding", "approvals", "dashboard"):
        return True
    if surface in ("workflow", "dashboard", "data_pipeline", "automation"):
        return True
    if product_domain in ("admin_dashboard", "workflow_system", "automation_system", "data_pipeline"):
        return True
    return False


def build_company_operations_model(
    intent: TqGenIntent,
    surface: SurfaceKind,
    product_domain: ProductDomain,
) -> Dict[str, Any]:
    """
    Compact JSON for the LLM: how to encode approvals, ownership, audit, and handoffs in a valid .tq.
    """
    wf_model: List[str] = [
        "Map business **status** and **stage** as explicit identifiers in `requires` (e.g. case_status, stage_code).",
        "Model **approvals** with stable ids: request_id, approval_id or approver_id, policy_tier, decision_outcome when implied.",
        "Capture **escalation** paths: escalation_tier, manager_queue_id, or delegate_of_request_id.",
        "Reserve **rejection** / exception handles: rejection_code, return_to_stage, or rework_reason_id.",
        "For **retries** / system reliability: retry_count, dlq_topic, last_error_code, correlation_id.",
        "For **ownership**: owner_id, assignee_id, actor_role, team_id, or queue_id as the story demands.",
    ]
    entities = [
        "users (user_id, actor_role)",
        "requests / cases (request_id, case_id)",
        "records (record_id, entity_type)",
        "approvals (approval_id, approver_id, policy_tier)",
        "tasks (task_id, task_status)",
        "notifications (notification_id, channel, template_id)",
        "documents (document_id, revision, evidence_uri or storage_key)",
    ]
    ops = [
        "**Audit-friendly**: when the user mentions compliance or audit trails, include ip_address, actor_id, "
        "decision_at or audit_event_id in `requires` and align `flow:` with session effects if operators sign in.",
        "**Event / log correlation**: correlation_id, batch_id, or trace_id for cross-step data movement.",
        "**Step transitions**: from_status, to_status (or stage_from, stage_to) when modeling pipeline UIs.",
        "**Role-aware actions**: role_code, permission_scope, or queue_scope paired with assignee_id.",
        "**Data movement between steps**: handoff_token, payload_ref, route_key, partition_id — especially for pipelines.",
    ]
    style = (
        "Target **internal operational software**: dense admin tables, filters, SLA callouts, and drawer/detail patterns. "
        "Express that structure via many `requires` fields and `#` zones (queue, detail, history, actions) — not prose outside `.tq`."
    )
    return {
        "version": 1,
        "intent_profile": intent,
        "surface_kind": surface,
        "product_domain": product_domain,
        "workflow_modeling": {
            "axes": wf_model,
            "tq_v1_note": (
                "Only `create session` and `emit login_success` (and guarded variants) are valid inside `flow:`. "
                "Encode business steps as named fields and comments; use `flow:` when the story includes operator login/session."
            ),
        },
        "business_entities": {"model_as_requires": entities},
        "operational_behaviors": {"contracts": ops},
        "output_generation_style": {"tone": "company_internal_console", "guidance": style},
    }


def merge_company_ops_into_domain_plan(
    domain_plan: Dict[str, Any],
    intent: TqGenIntent,
    surface: SurfaceKind,
    product_domain: ProductDomain,
) -> Dict[str, Any]:
    """Attach P128 summary onto existing P125 domain_plan for a single JSON blob."""
    if not company_grade_plan_applies(intent, surface, product_domain):
        return domain_plan
    out = dict(domain_plan)
    out["company_operations_p128"] = {
        "applies": True,
        "summary": (
            "Encode statuses, approvals, escalation, rejections, retries, and roles as explicit `requires` identifiers; "
            "partition the spec with `#` comments like an internal ops app (queue, SLA, approvals matrix, audit trail)."
        ),
    }
    return out

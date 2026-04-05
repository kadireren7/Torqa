"""
P125: Product-domain awareness for .tq generation (planning only — IR + parser stay canonical).

Domains describe *what kind of system* the user is asking for so the model adapts shape
(marketing vs app vs workflow vs automation vs data movement) without changing TORQA syntax.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Literal

from src.ai.tq_intent import TqGenIntent

ProductDomain = Literal[
    "marketing_site",
    "product_web_app",
    "admin_dashboard",
    "workflow_system",
    "automation_system",
    "data_pipeline",
    "generic",
]


def _has(t: str, pat: str) -> bool:
    return re.search(pat, t, re.I) is not None


def infer_product_domain(raw_prompt: str, surface: str, intent: TqGenIntent) -> ProductDomain:
    """
    Coarse product domain for planning. Combines prompt text with surface + intent (P125).

    Order: specialized operational domains before broad product/app wording.
    """
    t = (raw_prompt or "").lower()
    if not t.strip():
        return "generic"

    # Data movement / transformation (before generic "pipeline" automation)
    if surface == "data_pipeline" or _has(
        t,
        r"\b("
        r"etl\b|elt\b|data[\s-]?pipeline|stream[\s-]?processing|cdc\b|change[\s-]?data[\s-]?capture|"
        r"ingest|ingestion|message[\s-]?(router|routing)|route[\s-]?(records|events)|"
        r"transform[\s-]?(records|rows|events|batch)|field[\s-]?mapping|schema[\s-]?evolution|"
        r"dead[\s-]?letter|replay[\s-]?queue|kafka|redpanda|pub[\s-]?sub"
        r")\b",
    ):
        return "data_pipeline"

    if intent == "approvals" or surface == "workflow" or _has(
        t,
        r"\b("
        r"multi[\s-]?(step|stage)[\s-]?approval|approval[\s-]?(chain|matrix|workflow)|"
        r"human[\s-]?(gate|review)|sign[\s-]?off|maker[\s-]?checker|delegat(e|ion)[\s-]?path"
        r")\b",
    ):
        return "workflow_system"

    if surface == "automation" or intent == "automation":
        return "automation_system"

    # Internal / ops surfaces before generic "app"
    if _has(
        t,
        r"\b("
        r"internal[\s-]?(tool|app|portal|dashboard)|admin[\s-]?(console|panel|ui)|backoffice|"
        r"employee[\s-]?portal|hr[\s-]?(portal|admin)|ops[\s-]?(console|dashboard)|"
        r"it[\s-]?service[\s-]?desk|support[\s-]?agent[\s-]?ui"
        r")\b",
    ):
        return "admin_dashboard"

    if surface == "dashboard" or intent == "dashboard":
        return "admin_dashboard"

    if surface == "website" or intent == "landing":
        return "marketing_site"

    if surface == "app" or intent in ("auth", "crud", "crm", "onboarding"):
        return "product_web_app"

    return "generic"


def build_domain_plan(
    domain: ProductDomain,
    intent: TqGenIntent,
    surface: str,
    entities: List[str],
) -> Dict[str, Any]:
    """
    Compact machine-facing plan (injected in structured JSON). Not end-user prose.
    """
    ent_sample = [str(e) for e in (entities or [])[:8]]
    core: Dict[str, Any] = {
        "product_domain": domain,
        "surface_kind": surface,
        "generation_profile": intent,
        "entity_hints": ent_sample,
    }

    if domain == "marketing_site":
        core["emit_expectations"] = {
            "layout": "sectioned_marketing",
            "sections": ["hero", "value_props", "social_proof", "primary_cta", "secondary_capture"],
            "requires_focus": "lead_capture_fields",
            "flow": "empty_unless_explicit_signin",
            "comments": "name_zones_for_hero_trust_cta",
        }
    elif domain == "product_web_app":
        core["emit_expectations"] = {
            "layout": "multi_screen_product",
            "screens": ["entry_or_auth", "primary_task", "supporting_actions"],
            "requires_focus": "user_visible_fields_and_resource_ids",
            "flow": "session_only_if_user_asked_success_path",
            "comments": "optional_screen_or_feature_sections",
        }
    elif domain == "admin_dashboard":
        core["emit_expectations"] = {
            "layout": "dense_read_ops",
            "zones": ["filters_or_scope", "primary_kpis", "detail_table_or_drilldown"],
            "requires_focus": "metrics_scope_and_dimensions",
            "flow": "empty_unless_authenticated_shell",
            "comments": "partition_filter_kpi_detail_zones",
        }
    elif domain == "workflow_system":
        core["emit_expectations"] = {
            "layout": "stateful_handoffs",
            "model": [
                "case_or_request_id",
                "actors",
                "decision_outcomes",
                "sla_or_deadline",
                "escalation_or_rejection_path",
                "retry_or_correlation_handles",
            ],
            "requires_focus": "stable_case_and_actor_ids",
            "flow": "include_steps_when_decision_or_session_recorded",
            "comments": "stages_approval_matrix_audit_escalation_zones",
        }
    elif domain == "automation_system":
        core["emit_expectations"] = {
            "layout": "trigger_to_outcome",
            "model": ["trigger_or_run_id", "integration_handles", "retry_or_dlq", "audit_reference"],
            "requires_focus": "run_correlation_ids",
            "flow": "empty_unless_login_wrapped_tooling",
            "comments": "trigger_transform_publish_zones",
        }
    elif domain == "data_pipeline":
        core["emit_expectations"] = {
            "layout": "source_transform_sink",
            "model": [
                "source_cursor_or_offset",
                "transform_version",
                "route_or_partition_key",
                "sink_target",
                "batch_or_window_id",
                "audit_or_evidence_reference",
                "retention_or_legal_hold_flag",
            ],
            "requires_focus": "routing_and_lineage_ids",
            "flow": "empty",
            "comments": "stage_extract_map_load_compliance_handoff",
        }
    else:
        core["emit_expectations"] = {
            "layout": "minimal_valid_surface",
            "requires_focus": "smallest_story_aligned_set",
            "flow": "empty_unless_explicit_session",
        }

    return core


def domain_planning_one_liner(domain: ProductDomain) -> str:
    """Short NL nudge for the markdown plan (avoid duplicating JSON)."""
    return {
        "marketing_site": "Treat as marketing: zones + CTA + capture fields in requires/comments; not a full CRUD app unless asked.",
        "product_web_app": "Treat as product UI: named screens/inputs/actions reflected in requires; session flow only if requested.",
        "admin_dashboard": "Treat as internal/analytics shell: scope + KPI dimensions in requires; dense comments for zones.",
        "workflow_system": "Treat as approvals/handoffs: case + actor + policy ids; flow steps when decisions are recorded.",
        "automation_system": "Treat as system automation: triggers, run ids, integration handles; usually empty flow.",
        "data_pipeline": "Treat as data movement: source/transform/route/sink identifiers; empty flow; stage comments.",
        "generic": "Default: smallest valid .tq matching the user story.",
    }[domain]

"""
P109: deterministic NL planning hints for .tq generation (no extra LLM round).

Surface kind + compact plan guide the main generator while keeping product UX prompt-only.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from src.ai.tq_intent import TqGenIntent, normalize_prompt_text
from src.ai.tq_domain import domain_planning_one_liner, infer_product_domain

SurfaceKind = Literal["website", "app", "workflow", "automation", "dashboard", "data_pipeline", "generic"]

_ENTITY_LEXICON = frozenset(
    {
        "user",
        "customer",
        "order",
        "invoice",
        "ticket",
        "product",
        "session",
        "approval",
        "approver",
        "webhook",
        "admin",
        "report",
        "payment",
        "subscription",
        "team",
        "role",
        "email",
        "password",
        "username",
        "dashboard",
        "metric",
        "kpi",
        "lead",
        "visitor",
        "case",
        "run",
        "pipeline",
        "queue",
        "audit",
        "notification",
        "task",
        "event",
        "form",
        "record",
        "inventory",
        "shipment",
        "account",
        "onboarding",
        "provisioning",
        "journey",
        "opportunity",
        "requisition",
        "stakeholder",
        "funnel",
        "churn",
        "tenant",
        "delegate",
        "document",
        "request",
        "status",
        "escalation",
        "retry",
        "assignee",
        "sla",
        "stage",
        "reviewer",
        "workflow",
        "handler",
        "correlation",
        "transform",
        "sink",
        "source",
        "partition",
        "revision",
        "evidence",
        "compliance",
    }
)

# One-line internal nudges (not shown in product UI); keep tiny for token budget.
_SURFACE_GUIDANCE: dict[SurfaceKind, str] = {
    "website": "Marketing / static-first: one primary capture field unless user asked for sign-in.",
    "app": "Interactive product UI: primary identifier + fields the user named; session flow only if they asked.",
    "workflow": "Human-in-the-loop steps: stable actor/case ids in requires; flow often empty unless login requested.",
    "automation": "System/process automation: run ids, secrets, triggers; empty flow unless credentials/session explicit.",
    "dashboard": "Read-heavy / KPI surface: resource id first, metrics as named fields; avoid password-only requires.",
    "data_pipeline": "Move/transform data: stable source, batch/window, transform, route/partition, sink — empty flow; rich requires.",
    "generic": "Minimal valid .tq; prefer smallest requires + empty flow unless user clearly asked for session success.",
}


def infer_surface_kind(raw_prompt: str) -> SurfaceKind:
    """
    Coarse deliverable shape for planning (orthogonal to TqGenIntent profile).

    Order: more specific operational signals before broad marketing wording.
    """
    t = (raw_prompt or "").lower()
    if not t.strip():
        return "generic"

    def _has(pat: str) -> bool:
        return re.search(pat, t, re.I) is not None

    # P125: data movement / routing (before generic automation)
    if _has(
        r"\b("
        r"etl\b|elt\b|data[\s-]?pipeline|stream[\s-]?processing|cdc\b|change[\s-]?data[\s-]?capture|"
        r"ingest|ingestion|message[\s-]?(router|routing)|route[\s-]?(records|events)|"
        r"transform[\s-]?(records|rows|events|batch)|field[\s-]?mapping|schema[\s-]?evolution|"
        r"dead[\s-]?letter|replay[\s-]?queue|kafka|redpanda|pub[\s-]?sub"
        r")\b"
    ):
        return "data_pipeline"

    # Automation / systems (before generic "workflow" English)
    if _has(
        r"\b("
        r"webhook|cron|schedule|event[\s-]?driven|queue|worker|pipeline|sync\b|integrat|"
        r"api[\s-]?call|retry|dead[\s-]?letter|lambda|serverless"
        r")\b"
    ):
        return "automation"

    if _has(
        r"\b("
        r"approval|approver|human[\s-]?review|sign[\s-]?off|stakeholder|escalat|"
        r"handoff|sla|business[\s-]?process|bpmn|stage\s+gate"
        r")\b"
    ):
        return "workflow"

    if _has(
        r"\b("
        r"dashboard|kpi|analytics[\s-]?(panel|view)?|metrics?\s+grid|executive[\s-]?summary|"
        r"chart|reporting[\s-]?ui|data[\s-]?viz"
        r")\b"
    ):
        return "dashboard"

    if _has(
        r"\b("
        r"\bapp\b|web[\s-]?app|spa\b|mobile[\s-]?app|sign[\s-]?in|log[\s-]?in|login|sign[\s-]?up|"
        r"register|onboarding|multi[\s-]?step|wizard|screen\b|settings\s+page|profile\s+page"
        r")\b"
    ):
        return "app"

    if _has(
        r"\b("
        r"landing|marketing[\s-]?page|brochure|hero\b|waitlist|lead[\s-]?capture|"
        r"homepage|single[\s-]?page|cta\b|newsletter|seo\b|static\s+site"
        r")\b"
    ):
        return "website"

    return "generic"


def _extract_entities(norm: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    def _add(s: str) -> None:
        x = s.strip()
        if len(x) < 2 or len(x) > 48:
            return
        key = x.lower()
        if key in seen:
            return
        seen.add(key)
        found.append(x)

    for m in re.finditer(r"`([^`\n]{1,40})`", norm):
        _add(m.group(1))
    for m in re.finditer(r'"([^"\n]{2,40})"', norm):
        _add(m.group(1))
    for m in re.finditer(r"'([^'\n]{2,40})'", norm):
        _add(m.group(1))
    for m in re.finditer(r"\b([a-z][a-z0-9_]{1,30})\b", norm.lower()):
        w = m.group(1)
        if w in _ENTITY_LEXICON:
            _add(w)
        if len(found) >= 14:
            break
    return found[:12]


def _infer_outputs(surface: SurfaceKind, intent: TqGenIntent) -> list[str]:
    if intent == "auth":
        return ["SessionReady", "LoginSuccessful", "OK"]
    if intent == "landing":
        return ["LeadCaptured", "WaitlistJoined", "NewsletterOk", "OK"]
    if intent == "automation":
        return ["WorkflowComplete", "ApprovalRecorded", "RunSucceeded", "OK"]
    if intent == "crm":
        return ["DealUpdated", "PipelineSynced", "HandoffReady", "RecordSaved", "OK"]
    if intent == "onboarding":
        return ["StepCompleted", "JourneyReady", "ProvisioningDone", "TrialActivated", "OK"]
    if intent == "approvals":
        return ["DecisionRecorded", "Approved", "Rejected", "Escalated", "PendingReview", "OK"]
    if intent == "dashboard":
        return ["DashboardLoaded", "ReportRefreshed", "SliceSelected", "ExportReady", "OK"]
    if surface == "dashboard":
        return ["ShellLoaded", "ReportReady", "OK"]
    if surface == "data_pipeline":
        return ["BatchCommitted", "RouteApplied", "TransformOk", "SinkReady", "OK"]
    if surface == "workflow":
        return ["ApprovalRecorded", "StepComplete", "OK"]
    if intent == "crud":
        return ["ListReady", "RecordSaved", "DeleteOk", "OK"]
    return ["OK"]


def _structure_hints(surface: SurfaceKind, intent: TqGenIntent) -> list[str]:
    hints: list[str] = []
    hints.append(f"Surface: {surface}; profile: {intent}.")
    hints.append(_SURFACE_GUIDANCE[surface])
    if surface == "website" and intent == "generic":
        hints.append("If the text is marketing-only, prefer landing-style capture (email/lead) rather than a full app spec.")
    if intent == "auth":
        hints.append("If login success: requires username or email before password; optional ip_address for audit.")
    elif intent == "landing":
        hints.append("Avoid password in requires unless the user explicitly asked for account creation/sign-in.")
    elif intent == "crud":
        hints.append("Start requires with a resource key (e.g. product_id, order_id) plus named attributes.")
    elif intent == "automation":
        hints.append("Use stable workflow identifiers (run_id, case_id, approver_id) the user implied.")
    elif intent == "crm":
        hints.append(
            "Model accounts, contacts, deals, and stages: at least four `requires` ids; use comments for pipeline zones."
        )
        hints.append(
            "P128: add task, notification, or handoff identifiers when describing sales or support operations consoles."
        )
    elif intent == "onboarding":
        hints.append(
            "Encode wizard progress in `requires` (step index, variant, completion); describe ordered phases in `#` comments."
        )
        hints.append(
            "P128: include provisioning / audit hooks (queue ids, audit_event_id) when IT or compliance onboarding is implied."
        )
    elif intent == "approvals":
        hints.append(
            "Capture request, approver, policy tier, amounts/deadlines in `requires`; include at least one valid `flow:` step when recording decisions."
        )
        hints.append(
            "P128: model escalation tiers, rejection codes, correlation ids, and owner/queue handles when the story implies enterprise workflow."
        )
    elif intent == "dashboard":
        hints.append(
            "Dense metrics model: time range, dimension, metric keys, comparison period — four+ fields; comments for KPI zones."
        )
        hints.append(
            "P128: internal ops style — drilldown entity, comparison window, export job, anomaly flags as named `requires` when relevant."
        )
    else:
        hints.append("Prefer the smallest valid requires line; empty flow unless session path is explicit.")
    return hints


def _required_actions(surface: SurfaceKind, intent: TqGenIntent) -> list[str]:
    actions = [
        "Emit JSON with only key tq.",
        "Match parser rules: comma-separated requires, intent snake_case, two-space flow steps only.",
    ]
    if intent == "auth":
        actions.append("If and only if user asked for successful login: create session + emit login_success with ensures.")
    elif intent == "landing":
        actions.append("Keep flow empty for lead/marketing unless user asked for authenticated session.")
    elif intent in ("automation", "approvals") or surface in ("workflow", "automation", "data_pipeline"):
        actions.append(
            "When the story implies recording a decision or handoff, include valid indented `flow:` steps per tq_v1; "
            "otherwise keep empty flow only if `requires` is richly specified per profile."
        )
    if surface == "data_pipeline":
        actions.append(
            "Data pipeline: encode source, transform, route, and sink identity in `requires`; use `#` comments for stages; "
            "keep `flow:` empty unless the user explicitly asked for a login-wrapped operator UI."
        )
    elif intent in ("crm", "dashboard", "onboarding"):
        actions.append(
            "Prefer four or more comma-separated `requires` identifiers reflecting the business data model; "
            "use `#` section comments for multi-part UX."
        )
    if intent in ("approvals", "crm", "onboarding", "dashboard") or surface in ("workflow", "dashboard", "data_pipeline"):
        actions.append(
            "P128 company operations: express statuses, ownership, audit/event correlation, and handoffs as explicit identifiers — "
            "target internal admin / process tooling density, not consumer-minimal shells."
        )
    return actions


def build_nl_plan(raw_prompt: str, intent: TqGenIntent, surface: SurfaceKind) -> dict[str, Any]:
    norm = normalize_prompt_text(raw_prompt)
    entities = _extract_entities(norm)
    product_domain = infer_product_domain(raw_prompt, surface, intent)
    structure = _structure_hints(surface, intent)
    # P125: one domain line up front; details live in structured JSON domain_plan.
    structure.insert(0, f"Product domain: {product_domain} — {domain_planning_one_liner(product_domain)}")
    return {
        "surface_kind": surface,
        "generation_profile": intent,
        "product_domain": product_domain,
        "entities_guess": entities,
        "likely_result_labels": _infer_outputs(surface, intent)[:5],
        "structure_hints": structure,
        "required_actions": _required_actions(surface, intent),
    }


def format_nl_plan_markdown(plan: dict[str, Any]) -> str:
    """Compact block injected before profile rules in the user message."""
    lines = [
        "## Inferred request (internal planning — follow in the `.tq`)",
        f"- **Surface kind**: {plan.get('surface_kind', 'generic')}",
        f"- **Product domain (P125)**: {plan.get('product_domain', 'generic')}",
        f"- **Generation profile**: {plan.get('generation_profile', 'generic')}",
    ]
    ents = plan.get("entities_guess") or []
    if ents:
        lines.append(f"- **Likely entities / fields to reflect in `requires`**: {', '.join(str(e) for e in ents)}")
    outs = plan.get("likely_result_labels") or []
    if outs:
        lines.append(f"- **Reasonable `result` labels** (pick one that fits): {', '.join(str(o) for o in outs)}")
    lines.append("- **Structure**:")
    for h in plan.get("structure_hints") or []:
        lines.append(f"  - {h}")
    lines.append("- **Actions**:")
    for a in plan.get("required_actions") or []:
        lines.append(f"  - {a}")
    return "\n".join(lines) + "\n"

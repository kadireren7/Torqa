"""
Deterministic NL -> generation profile for .tq LLM authoring (P83).

Used only to pick structured rules; parsing/validation remains strict in ``parse_tq``.
"""

from __future__ import annotations

import re
from typing import Literal

TqGenIntent = Literal[
    "auth",
    "landing",
    "crud",
    "automation",
    "crm",
    "onboarding",
    "approvals",
    "dashboard",
    "generic",
]

_VALID_FORCED_CATEGORY: frozenset[str] = frozenset(
    {
        "landing",
        "crud",
        "automation",
        "crm",
        "onboarding",
        "approvals",
        "dashboard",
    }
)


def resolve_tq_gen_intent(user_prompt: str, forced_category: str | None = None) -> TqGenIntent:
    """
    Pick the active generation profile.

    When ``forced_category`` is a known product category, it wins over heuristic classification
    (desktop / CLI ``--gen-category``).
    """
    if forced_category:
        c = forced_category.strip().lower()
        if c in _VALID_FORCED_CATEGORY:
            return c  # type: ignore[return-value]
    return classify_tq_gen_intent(user_prompt)


def normalize_prompt_text(raw: str) -> str:
    """Trim, strip lines, collapse excessive blank lines (better model focus)."""
    s = (raw or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not s:
        return ""
    lines = [ln.rstrip() for ln in s.split("\n")]
    out: list[str] = []
    blank_run = 0
    for ln in lines:
        if not ln.strip():
            blank_run += 1
            if blank_run <= 1:
                out.append("")
        else:
            blank_run = 0
            out.append(ln)
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out).strip()


def classify_tq_gen_intent(prompt: str) -> TqGenIntent:
    """
    Map free text to a small set of authoring profiles.

    Order: auth-sensitive phrases win over marketing wording (e.g. "landing with login").
    """
    t = (prompt or "").lower()
    if not t.strip():
        return "generic"

    def _has(pat: str) -> bool:
        return re.search(pat, t, re.I) is not None

    # Auth / credentials
    if _has(
        r"\b("
        r"sign[\s-]?in|log[\s-]?in|login|password|credential|authenticate|authentication|"
        r"mfa|2fa|sso|oauth|jwt|session[\s-]?token|magic[\s-]?link"
        r")\b"
    ):
        return "auth"

    # P118: human approval chains (before broad "workflow" / automation)
    if _has(
        r"\b("
        r"approval[\s-]?(pipeline|chain|matrix|workflow)|multi[\s-]?(level|stage)[\s-]?approval|"
        r"purchase[\s-]?(order|req(uisition)?)[\s-]?approval|delegat(e|ion)[\s-]?path|"
        r"four[\s-]?eyes|maker[\s-]?checker|stakeholder[\s-]?(sign[\s-]?off|review)"
        r")\b"
    ):
        return "approvals"

    # P118: CRM / revenue ops
    if _has(
        r"\b("
        r"\bcrm\b|salesforce|hubspot|customer[\s-]?(360|relationship|health)|"
        r"sales[\s-]?(pipeline|funnel|forecast)|deal[\s-]?(stage|opportunity|desk)|"
        r"account[\s-]?(exec|owner|team)|lead[\s-]?(score|routing|queue)|"
        r"opportunity[\s-]?(stage|amount)|contact\s+(record|history)"
        r")\b"
    ):
        return "crm"

    # P118: product onboarding / provisioning journeys
    if _has(
        r"\b("
        r"onboarding|welcome[\s-]?(flow|journey)|setup[\s-]?(wizard|flow)|"
        r"first[\s-]?(run|login)[\s-]?(flow|experience)|trial[\s-]?(activation|onboarding)|"
        r"user[\s-]?provisioning|account[\s-]?(setup|creation)[\s-]?(wizard|flow)|"
        r"guided[\s-]?(setup|tour)|checklist[\s-]?(flow|wizard)"
        r")\b"
    ):
        return "onboarding"

    # P118: read-heavy analytics surfaces (before generic CRUD admin)
    if _has(
        r"\b("
        r"dashboard|executive[\s-]?(summary|dashboard)|kpi[\s-]?(board|wall|grid|tree)|"
        r"metrics[\s-]?(wall|hub|console)|analytics[\s-]?(hub|console|workspace)|"
        r"data[\s-]?(studio|explorer|viz|visualization)|reporting[\s-]?(portal|suite)|"
        r"bi\b|looker|power[\s-]?bi|embedded[\s-]?analytics"
        r")\b"
    ):
        return "dashboard"

    if _has(
        r"\b("
        r"crud|create[\s-]?read|list\s+view|data[\s-]?(grid|table)|entity\b|entities\b|records?\b|"
        r"inventory|admin[\s-]?(panel|ui)|sidebar[\s-]?nav|"
        r"edit\s+row|delete\s+record|form\s+for\b"
        r")\b"
    ):
        return "crud"

    if _has(
        r"\b("
        r"automation|workflow|approval|approver|webhook|trigger|pipeline|queue|cron|"
        r"orchestrat|audit[\s-]?trail|sla|escalat"
        r")\b"
    ):
        return "automation"

    if _has(
        r"\b("
        r"landing|marketing[\s-]?page|hero|waitlist|lead[\s-]?capture|brochure|"
        r"homepage|single[\s-]?page|cta\b|newsletter[\s-]?signup"
        r")\b"
    ):
        return "landing"

    return "generic"


_PROFILE_RULES: dict[TqGenIntent, str] = {
    "auth": """- **requires**: start with `username` OR `email` as the first field, then `password`. If the user asked for audit/IP logging, add `ip_address` last (e.g. `requires email, password, ip_address`).
- **forbid / ensures**: optional `forbid locked`; if you emit `create session`, add line `ensures session.created` before `result`.
- **flow**: if the user wants a successful sign-in path, use exactly:
    flow:
      create session
      emit login_success
  If they only asked for a "form" without backend story, you may use an **empty** flow (nothing under `flow:`).
- **result**: PascalCase or short label, e.g. `SessionReady`, `Login Successful`.""",
    "landing": """- **requires**: marketing / one-page sites — prefer **one** primary capture field: `email`, `visitor_email`, or `lead_name` (no `password` unless the user explicitly asked for sign-in). First field must NOT be only `password` or `ip_address`.
- **flow**: **empty** `flow:` for static/lead pages unless the user clearly asked for login + session success path.
- **result**: marketing-flavoured PascalCase, e.g. `LeadCaptured`, `WaitlistJoined`, `NewsletterOk`, or `OK`.
- **intent**: snake_case page name, e.g. `saas_landing`, `product_waitlist`, `hero_cta_page`.
- **tone**: reflect hero, benefits, CTA, social proof, pricing section only in the *user request* text — keep the .tq file minimal (requires/result/flow only).""",
    "crud": """- **requires**: data / admin / CRUD — put a **resource key first**: `product_id`, `customer_id`, `order_id`, or `record_id`. Add comma-separated attributes the user named for tables/forms (`name`, `status`, `quantity`, `updated_at`). Do **not** use only `password` unless they asked for secrets.
- **flow**: **empty** unless the user explicitly asked for `create session` / login emits.
- **result**: action-oriented PascalCase, e.g. `ListReady`, `RecordSaved`, `DeleteOk`, `ShellLoaded`, or `OK`.
- **intent**: snake_case resource + context, e.g. `product_inventory_admin`, `ticket_queue_crud`, `customer_records`.
- **scope**: list/detail/create/edit/delete are described in the user request — the .tq stays a single minimal surface (no multi-file).""",
    "automation": """- **requires**: workflows / tools — list **stable identifiers** the user mentioned, comma-separated, e.g. `run_id, approver_id, case_id, webhook_secret`. First field must be a real workflow id or actor id (not only `password`). Add `password` only if they asked for credentials.
- **flow**: **empty** unless they explicitly asked for login/session; automation specs usually validate with empty flow + structured `requires`.
- **result**: e.g. `WorkflowComplete`, `ApprovalRecorded`, `RunSucceeded`, `OK`.
- **intent**: snake_case flow name, e.g. `invoice_approval_pipeline`, `deploy_gate`, `ticket_escalation`.
- **tone**: triggers, approvals, SLA, webhooks, audit timestamps belong in the *user request* — keep .tq minimal.""",
    "crm": """- **requires**: **at least four** comma-separated business identifiers — start with an account or record key, then fields the user named, e.g. `account_id, contact_id, deal_stage, owner_id, last_activity_at, territory`. Reflect pipelines, owners, stages, and segments from the request. Never `password`-only.
- **flow**: **empty** unless the story explicitly needs `create session` + `emit login_success` (e.g. rep portal login).
- **result**: outcome labels such as `DealUpdated`, `HandoffReady`, `PipelineSynced`, `RecordSaved`.
- **intent**: snake_case, e.g. `account_360_view`, `opportunity_pipeline_board`, `lead_routing_queue`.
- **tone**: use `#` comments to group **sections** (e.g. pipeline, activities, ownership) — parser allows comments before `flow:`; keep step lines only where the global syntax allows.""",
    "onboarding": """- **requires**: **at least four** fields that encode **multi-step** state, e.g. `user_id, onboarding_step, journey_variant, completion_pct, tenant_id, checklist_item_id`. Name steps and gates from the user story (welcome, profile, billing, invite team, etc.).
- **flow**: **empty** unless they asked for authenticated session success; multi-step *logic* is captured in `requires` + `#` comments (tq_v1 flow steps are limited — describe phases in comments).
- **result**: e.g. `StepCompleted`, `JourneyReady`, `ProvisioningDone`, `TrialActivated`.
- **intent**: snake_case, e.g. `saas_onboarding_wizard`, `b2b_trial_activation`, `employee_provisioning_flow`.
- **tone**: explicitly mirror **ordered phases** in comments so downstream UI can map screens.""",
    "approvals": """- **requires**: stable ids for the **case** and **actors**, e.g. `request_id, approver_id, delegate_id, policy_tier, amount_cents, sla_deadline_at`. At least four identifiers when the story is non-trivial.
- **flow**: include **at least one** valid indented step under `flow:` (e.g. `create session` / `emit login_success`) when the story implies submission or decision recording; if the user only asked for a policy/data capture with no session story, you may use an empty `flow:` **only** if `requires` is rich enough.
- **result**: e.g. `Approved`, `Rejected`, `Escalated`, `PendingReview`, `DecisionRecorded`.
- **intent**: snake_case, e.g. `po_approval_chain`, `contract_review_gate`, `expense_sign_off`.
- **tone**: capture levels, thresholds, and escalation in `requires` + `#` comments.""",
    "dashboard": """- **requires**: **at least four** fields for **data-heavy** surfaces: keys for scope + measures, e.g. `report_id, metric_key, time_range, dimension, comparison_period, refresh_token`. Tie names to KPIs, filters, and drill-downs the user mentioned.
- **flow**: **empty** unless they explicitly asked for sign-in/session success on the dashboard.
- **result**: e.g. `DashboardLoaded`, `ReportRefreshed`, `SliceSelected`, `ExportReady`.
- **intent**: snake_case, e.g. `executive_kpi_dashboard`, `sales_metrics_hub`, `operations_control_tower`.
- **tone**: use `#` comments to separate **zones** (filters, primary KPIs, detail tables) — keep .tq valid and dense on `requires`.""",
    "generic": """- **requires**: safest default `requires username, password` (comma-separated). First identifier must not be only `password`.
- **flow**: **empty** unless the user clearly asked for session + success emit.
- **result**: `OK` or a short PascalCase label.
- **intent**: snake_case derived from the request, e.g. `user_request_flow`.""",
}


def profile_rules_markdown(intent: TqGenIntent) -> str:
    return _PROFILE_RULES[intent]


def build_structured_user_message(
    raw_prompt: str,
    intent: TqGenIntent,
    *,
    nl_plan_markdown: str | None = None,
) -> str:
    norm = normalize_prompt_text(raw_prompt)
    rules = profile_rules_markdown(intent)
    core = (
        f"## Generation profile: {intent}\n"
        f"Apply the profile rules **together** with the global .tq syntax rules in the system message.\n\n"
        f"### Profile checklist\n{rules}\n\n"
        f"### User request\n{norm if norm else '(empty — produce a minimal valid idle .tq with intent user_intent and result OK)'}\n"
    )
    if nl_plan_markdown and nl_plan_markdown.strip():
        return f"{nl_plan_markdown.strip()}\n\n{core}"
    return core

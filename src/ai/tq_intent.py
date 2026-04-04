"""
Deterministic NL -> generation profile for .tq LLM authoring (P83).

Used only to pick structured rules; parsing/validation remains strict in ``parse_tq``.
"""

from __future__ import annotations

import re
from typing import Literal

TqGenIntent = Literal["auth", "landing", "crud", "automation", "generic"]

_VALID_FORCED_CATEGORY: frozenset[str] = frozenset({"landing", "crud", "automation"})


def resolve_tq_gen_intent(user_prompt: str, forced_category: str | None = None) -> TqGenIntent:
    """
    Pick the active generation profile.

    When ``forced_category`` is one of ``landing`` / ``crud`` / ``automation``, it wins over
    heuristic classification (desktop chips / CLI ``--gen-category``).
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

    if _has(
        r"\b("
        r"crud|create[\s-]?read|list\s+view|data[\s-]?(grid|table)|entity\b|entities\b|records?\b|"
        r"inventory|admin[\s-]?(panel|ui)|dashboard|analytics|kpi|metrics?|sidebar[\s-]?nav|"
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
    "generic": """- **requires**: safest default `requires username, password` (comma-separated). First identifier must not be only `password`.
- **flow**: **empty** unless the user clearly asked for session + success emit.
- **result**: `OK` or a short PascalCase label.
- **intent**: snake_case derived from the request, e.g. `user_request_flow`.""",
}


def profile_rules_markdown(intent: TqGenIntent) -> str:
    return _PROFILE_RULES[intent]


def build_structured_user_message(raw_prompt: str, intent: TqGenIntent) -> str:
    norm = normalize_prompt_text(raw_prompt)
    rules = profile_rules_markdown(intent)
    return (
        f"## Generation profile: {intent}\n"
        f"Apply the profile rules **together** with the global .tq syntax rules in the system message.\n\n"
        f"### Profile checklist\n{rules}\n\n"
        f"### User request\n{norm if norm else '(empty — produce a minimal valid idle .tq with intent user_intent and result OK)'}\n"
    )

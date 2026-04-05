"""
P115 / P122 / P126: Heuristic quality gate for LLM-authored .tq surfaces (post-parse / post-diagnostics).

Runs **after** the strict TORQA validator passes. Rejects barebones outputs, applies a **structured
quality floor** (dimensions + threshold), and drives refinement passes until the floor is met or
max retries — weak results are never accepted as final when the gate is enabled.

P126 adds domain-aware checks (aligned with P125 ``product_domain``), placeholder detection, and
explicit dimension scores for refinement feedback.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.ai.tq_intent import TqGenIntent
from src.surface.parse_tq import parse_tq_source


@dataclass
class TqQualityResult:
    passed: bool
    score: int
    hard_violations: List[str] = field(default_factory=list)
    soft_reasons: List[str] = field(default_factory=list)
    """P126: 0–100 sub-scores for layout, content, components, sections, coherence, placeholder hygiene."""
    dimensions: Dict[str, int] = field(default_factory=dict)

    def feedback_lines(self) -> List[str]:
        out: List[str] = []
        if self.hard_violations:
            out.append("Hard quality requirements (must fix):")
            out.extend(f"  - {v}" for v in self.hard_violations)
        if self.dimensions:
            out.append("Quality dimensions (0–100, target ≥60 each for a shippable spec):")
            for k, v in sorted(self.dimensions.items()):
                out.append(f"  - {k}: {v}")
        if not self.passed and self.soft_reasons:
            out.append(f"Heuristic quality score: {self.score}/100 (below threshold). Improve:")
            out.extend(f"  - {r}" for r in self.soft_reasons)
        return out


def _threshold_for_intent(intent_kind: str) -> int:
    """P122: Higher floors so razor-thin outputs rarely pass as final."""
    if intent_kind == "landing":
        return 52
    if intent_kind == "generic":
        return 56
    return 60


# Minimum raw .tq size (chars) before any scoring — ultra-short files are never shippable specs.
_MIN_TQ_CHARS = 100

_PLACEHOLDER_PATTERNS = (
    r"\blorem\b",
    r"\bipsum\b",
    r"\btodo\b",
    r"\bfixme\b",
    r"\bplaceholder\b",
    r"\btbd\b",
    r"\bxxx\b",
)


def _placeholder_violations(raw: str) -> List[str]:
    t = (raw or "").lower()
    for pat in _PLACEHOLDER_PATTERNS:
        if re.search(pat, t):
            return [
                "P126: Remove placeholder / dummy tokens (lorem, todo, fixme, placeholder, tbd, xxx) "
                "from the `.tq`; use real product identifiers and comments."
            ]
    return []


def _weak_intent_snake_violations(raw: str) -> List[str]:
    m = re.search(r"(?m)^intent\s+([a-z][a-z0-9_]*)\s*$", raw)
    if not m:
        return []
    name = m.group(1).lower()
    bad_subs = ("placeholder", "dummy", "foo", "bar", "test_only", "lorem")
    if any(b in name for b in bad_subs) or name in ("x", "y", "tmp", "temp"):
        return [
            f"P126: Intent name {name!r} looks like a stub; use a descriptive snake_case intent from the user story."
        ]
    return []


def _prompt_suggests_rich_automation(prompt: Optional[str]) -> bool:
    if not prompt or len(prompt.strip()) < 48:
        return False
    t = prompt.lower()
    keys = (
        "webhook",
        "trigger",
        "queue",
        "retry",
        "stage",
        "branch",
        "parallel",
        "sink",
        "transform",
        "route",
        "orchestrat",
        "dead letter",
        "dlq",
    )
    return sum(1 for k in keys if k in t) >= 3


def _domain_hard_violations(
    *,
    product_domain: Optional[str],
    user_prompt: Optional[str],
    kind: str,
    comment_lines: int,
    n_in: int,
    n_story_fields: int,
    n_tr: int,
) -> List[str]:
    if not product_domain:
        return []
    d = product_domain.strip().lower()
    out: List[str] = []
    if d == "marketing_site" and comment_lines < 2:
        out.append(
            "P126 (marketing domain): add at least two `#` section comments (hero, proof, CTA) — "
            "not a single blank marketing shell."
        )
    if d == "admin_dashboard" and n_in < 4:
        out.append(
            "P126 (admin/dashboard domain): at least **four** comma-separated `requires` identifiers "
            "(scope, metrics, dimensions, filters) for a meaningful analytics or ops surface."
        )
    if d == "workflow_system" and n_tr < 1:
        out.append(
            "P126 (workflow domain): include at least one valid indented `flow:` step when modeling "
            "handoffs or decisions (tq_v1 steps only)."
        )
    if d == "data_pipeline" and (n_story_fields < 4 or comment_lines < 2):
        out.append(
            "P126 (data pipeline domain): encode source/transform/route/sink lineage — at least **four** "
            "non-password `requires` fields and two `#` stage comments."
        )
    if d == "automation_system" and _prompt_suggests_rich_automation(user_prompt):
        if n_story_fields < 3:
            out.append(
                "P126 (automation domain): the prompt implies a non-trivial automation; expand `requires` "
                "(run ids, triggers, integration handles, stages, routes) — at least **three** non-password fields."
            )
    return out


def _non_password_input_count(inputs: Any) -> int:
    """Count `requires` fields other than password (parser mandates password for valid .tq)."""
    if not isinstance(inputs, list):
        return 0
    n = 0
    for it in inputs:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name") or "").strip().lower()
        if name and name != "password":
            n += 1
    return n


def _trivial_result_label(result_val: str) -> bool:
    s = (result_val or "").strip().lower()
    if len(s) <= 3:
        return True
    if s in ("ok", "result ok", "success", "done", "complete", "ready", "pending", "finished"):
        return True
    if s in ("result", "state", "status", "output", "response"):
        return True
    return False


def _compute_dimensions(
    *,
    modish: bool,
    comment_lines: int,
    n_in: int,
    n_story_fields: int,
    n_tr: int,
    result_val: str,
    raw_len: int,
    placeholder_ok: bool,
    weak_intent_ok: bool,
    kind: str,
) -> Dict[str, int]:
    """P126 structured sub-scores (0–100), orthogonal to legacy aggregate `score`."""
    layout = 20 + (30 if modish else 0) + min(35, comment_lines * 12) + (15 if raw_len >= 280 else 0)
    layout = max(0, min(100, layout))

    # Short but specific labels (e.g. LeadCaptured, SessionReady) must still score as real content.
    res_ok = len(result_val) >= 10 and not _trivial_result_label(result_val)
    content = 25 + min(45, n_story_fields * 12) + (30 if res_ok else 5)
    content = max(0, min(100, content))

    components = min(100, 20 + n_in * 10 + n_tr * 22)
    # Parser forces `password` on many surfaces; marketing landings are often email+password only
    # but section comments prove structure — avoid false "component" floor failures (P126).
    if kind == "landing" and comment_lines >= 2:
        components = max(components, 58)
    nav = min(100, 15 + comment_lines * 28 + (20 if comment_lines >= 3 else 0))

    # Flow / profile alignment (coherence)
    coh = 55
    if kind == "auth" and n_tr >= 2:
        coh = 95
    elif kind == "auth" and n_tr == 1:
        coh = 72
    elif kind in ("approvals", "automation") and n_tr >= 1:
        coh = 88
    elif n_tr >= 2:
        coh = 90
    elif n_tr == 1:
        coh = 70
    elif kind in ("landing", "generic") and n_tr == 0:
        coh = 75
    else:
        coh = 60

    ph = 100 if placeholder_ok else 0
    wi = 100 if weak_intent_ok else 35

    return {
        "layout_completeness": layout,
        "content_completeness": content,
        "component_completeness": components,
        "navigation_section_structure": nav,
        "app_workflow_coherence": coh,
        "placeholder_stub_hygiene": min(ph, wi),
    }


def evaluate_tq_quality(
    tq_text: str,
    *,
    intent_kind: str | TqGenIntent,
    synthetic_path: Path,
    enabled: bool = True,
    product_domain: Optional[str] = None,
    user_prompt: Optional[str] = None,
) -> TqQualityResult:
    if not enabled:
        return TqQualityResult(passed=True, score=100, dimensions={})

    raw = (tq_text or "").strip()
    if len(raw) < _MIN_TQ_CHARS:
        return TqQualityResult(
            passed=False,
            score=0,
            hard_violations=[
                f"Generated .tq is too short (under {_MIN_TQ_CHARS} chars) to be a usable product spec "
                "(expand structure, `#` section comments, `requires`, and `flow:` where the story needs it)."
            ],
            dimensions=_compute_dimensions(
                modish=False,
                comment_lines=0,
                n_in=0,
                n_story_fields=0,
                n_tr=0,
                result_val="",
                raw_len=len(raw),
                placeholder_ok=False,
                weak_intent_ok=False,
                kind=str(intent_kind),
            ),
        )

    ph_v = _placeholder_violations(raw)
    wi_v = _weak_intent_snake_violations(raw)
    placeholder_ok = len(ph_v) == 0
    weak_intent_ok = len(wi_v) == 0

    bundle: Dict[str, Any] = parse_tq_source(tq_text, tq_path=synthetic_path)
    ir = bundle.get("ir_goal") or {}
    inputs = ir.get("inputs") or []
    transitions = ir.get("transitions") or []
    result_val = str(ir.get("result") or "").strip()
    n_in = len(inputs) if isinstance(inputs, list) else 0
    n_tr = len(transitions) if isinstance(transitions, list) else 0
    n_story_fields = _non_password_input_count(inputs)

    kind = str(intent_kind)

    hard: List[str] = []
    hard.extend(ph_v)
    hard.extend(wi_v)

    if kind == "auth" and n_tr < 1:
        hard.append(
            "Auth profile: add at least one `flow:` step (typically `create session`; add `emit login_success` "
            "with `ip_address` in requires when login audit / success is part of the story)."
        )
    if kind == "crud" and n_in < 3:
        hard.append(
            "CRUD profile: add at least **three** comma-separated identifiers on `requires` "
            "(e.g. record_id, title, status) matching entities in the user's request."
        )
    if kind == "crm" and n_in < 4:
        hard.append(
            "CRM profile: add at least **four** comma-separated identifiers on `requires` "
            "so the spec can drive a data-heavy business UI (accounts, deals, owners, stages)."
        )
    if kind == "onboarding" and n_in < 4:
        hard.append(
            "Onboarding profile: add at least **four** comma-separated identifiers on `requires` "
            "(e.g. user_id, step, variant, tenant, checklist items) for multi-step journeys."
        )
    if kind == "dashboard" and n_in < 4:
        hard.append(
            "Dashboard profile: add at least **four** comma-separated identifiers on `requires` "
            "(e.g. report scope, metric keys, time range, dimensions) for analytics-heavy UIs."
        )
    if kind == "approvals" and n_in < 4:
        hard.append(
            "Approvals profile: add at least **four** comma-separated identifiers on `requires` "
            "(e.g. request_id, approver_id, policy_tier, amount_or_deadline fields)."
        )
    if kind == "automation" and n_tr < 1:
        hard.append(
            "Automation / workflow profile: add at least one concrete step under `flow:` "
            "(e.g. `create session` and/or `emit login_success` as appropriate to the story)."
        )
    if kind == "approvals" and n_tr < 1:
        hard.append(
            "Approvals profile: add at least one valid indented step under `flow:` "
            "(e.g. `create session` / `emit login_success`) when capturing a decision handoff."
        )
    if kind in ("auth", "crud", "automation", "crm", "onboarding", "approvals", "dashboard") and _trivial_result_label(
        result_val
    ):
        hard.append(
            f"Replace trivial `result` label {result_val!r} with a specific, user-visible outcome "
            "(e.g. `OrderSubmitted`, `SessionReady`, `LeadCaptured`)."
        )
    if kind == "generic" and n_tr < 1 and _trivial_result_label(result_val):
        hard.append(
            "Generic product build: add at least one indented step under `flow:` or use a concrete `result YourLabel` "
            "(not bare `OK` with an empty flow)."
        )

    comment_lines = sum(1 for ln in raw.split("\n") if ln.strip().startswith("#"))

    if kind == "landing" and comment_lines < 2:
        hard.append(
            "Landing / marketing profile: add at least two full-line `#` comments naming page sections "
            "(e.g. hero, proof, pricing, CTA). Password may be required by syntax, but the spec must still read as a page."
        )

    if kind == "generic" and n_tr < 1 and n_story_fields <= 2 and comment_lines < 2 and len(raw) < 380:
        hard.append(
            "Generic app shell is too empty: add at least two `#` section comments, expand `requires` to cover "
            "the user story, and/or add real `flow:` steps; not a minimal stub with no structure."
        )

    _dense_label = {"crm": "CRM", "onboarding": "Onboarding", "dashboard": "Dashboard", "approvals": "Approvals"}
    if kind in _dense_label and comment_lines < 2:
        hard.append(
            f"{_dense_label[kind]} profile: add at least two full-line `#` comments that partition the UI/spec "
            "(e.g. filters vs detail, stages, approval matrix, KPI zones)."
        )

    hard.extend(
        _domain_hard_violations(
            product_domain=product_domain,
            user_prompt=user_prompt,
            kind=kind,
            comment_lines=comment_lines,
            n_in=n_in,
            n_story_fields=n_story_fields,
            n_tr=n_tr,
        )
    )

    modish = "\nmodule " in ("\n" + raw) or raw.lstrip().lower().startswith("module ")
    dims = _compute_dimensions(
        modish=modish,
        comment_lines=comment_lines,
        n_in=n_in,
        n_story_fields=n_story_fields,
        n_tr=n_tr,
        result_val=result_val,
        raw_len=len(raw),
        placeholder_ok=placeholder_ok,
        weak_intent_ok=weak_intent_ok,
        kind=kind,
    )

    if hard:
        return TqQualityResult(passed=False, score=0, hard_violations=hard, dimensions=dims)

    score = 30
    soft: List[str] = []

    if modish:
        score += 14
    else:
        soft.append("Add a `module dotted.lowercase_name` line (namespace for the generated app).")

    if len(result_val) > 18 or not _trivial_result_label(result_val):
        score += 14
    else:
        soft.append("Use a longer, descriptive `result YourLabel` that names the business outcome.")

    score += min(18, n_in * 4)
    if n_in < 4 and kind in ("crud", "automation", "generic", "crm", "onboarding", "approvals", "dashboard"):
        soft.append("Add more `requires` fields so the UI has enough inputs to be useful (names match the user story).")

    if n_tr >= 2:
        score += 18
    elif n_tr == 1:
        score += 9
        if kind == "auth":
            soft.append(
                "If the user asked for sign-in with audit, add `emit login_success` and `ip_address` to `requires`."
            )
        elif kind in ("automation", "approvals"):
            soft.append("Consider a second flow step or richer inputs so the workflow is not a single effect only.")
    else:
        if kind not in ("landing",):
            soft.append("Strengthen `flow:` when the product story implies multiple stages or completion.")

    if comment_lines >= 3:
        score += 12
    elif comment_lines >= 2:
        score += 10
    else:
        soft.append("Add at least two full-line `#` comments explaining sections (intent, flow intent).")

    if len(raw) > 480:
        score += 10
    elif len(raw) > 420:
        score += 8
    elif len(raw) < 240:
        soft.append("Expand the file: more comments and/or richer `requires` so the spec is not razor-thin.")

    # P126: floor from dimensions — weak sub-scores drag the aggregate down (token trim cannot hide thin structure).
    dim_floor = min(dims.values()) if dims else 100
    if dim_floor < 58:
        penalty = max(0, 58 - dim_floor)
        score = max(0, score - min(22, penalty // 2))
        soft.append(
            f"P126 dimension floor: lowest axis is {dim_floor}/100 — raise layout, sections, components, or coherence."
        )

    score = max(0, min(100, score))
    thr = _threshold_for_intent(kind)
    passed = score >= thr and dim_floor >= 50
    if not passed and score >= thr and dim_floor < 50:
        soft.insert(0, f"P126: overall score {score} reached threshold {thr} but dimension floor {dim_floor} < 50 — expand weak axes.")

    if not passed and score < thr:
        soft.insert(0, f"Need score ≥ {thr} for profile {kind!r}; current score is {score}.")

    return TqQualityResult(passed=passed, score=score, soft_reasons=soft if not passed else [], dimensions=dims)


def format_quality_refinement_message(result: TqQualityResult, *, intent_kind: str) -> str:
    """LLM-facing refinement pass (after validation OK, quality NOT OK)."""
    lines = result.feedback_lines()
    core = "\n".join(lines) if lines else "Improve completeness without breaking tq_v1 syntax."
    return (
        "P126 quality refinement — pass 2 evaluated quality; pass 3 must refine weak areas. "
        "Output parsed and passed diagnostics but is **below the minimum quality floor**.\n"
        f"Active profile: `{intent_kind}`.\n"
        f"{core}\n\n"
        "Re-emit JSON with only key \"tq\". **Prioritize product completeness over brevity** (token count is secondary). "
        "Expand structure: meaningful `module`, descriptive `result`, sufficient `requires`, sectioning `#` comments, "
        "and `flow:` steps that match profile and domain expectations. "
        "Do not regress parser rules (comma-separated requires, two-space-indented flow lines only)."
    )

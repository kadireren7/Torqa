"""
P76/P83: LLM → ``.tq`` surface with parse + full diagnostics loop (no bypass).

Requires OPENAI_API_KEY. Output is validated with ``parse_tq_source`` and ``build_full_diagnostic_report``.
P83/P118: deterministic intent profiles (incl. CRM, onboarding, approvals, dashboards), structured user
envelope, and a system prompt aligned with real parser rules (no blanket “must include password”).
P127: explicit validation chain (parse → semantics → projection), failure taxonomy on attempts,
failure-aware repair nudges, and per-run reliability summary (not a global error-free guarantee).
P129: ``llm_gen_mode`` presets, optional same-provider ``fallback_model``, vendor-aware completion
limits (Claude), and ``llm_comparison_metrics`` on generation results.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.ai.openai_metrics import PRICING_NOTE, estimate_openai_cost_usd, normalize_usage
from src.ai.tq_autofix import autofix_tq_surface
from src.ai.tq_gen_model import get_tq_gen_model_hints, json_object_supported
from src.ai.tq_intent import build_structured_user_message, resolve_tq_gen_intent
from src.ai.tq_plan import build_nl_plan, format_nl_plan_markdown, infer_surface_kind
from src.ai.tq_structured_plan import build_structured_generation_plan, format_structured_plan_block
from src.ai.tq_llm_transport import (
    chat_completion_text,
    default_llm_model,
    llm_key_env_name,
    normalize_llm_provider,
    resolve_llm_api_key,
)
from src.ai.tq_gen_phases import (
    build_refinement_user_message,
    emit_tq_gen_progress,
    phase_rows,
    resolve_tq_gen_phases,
)
from src.ai.tq_llm_strategy import build_llm_comparison_metrics, resolve_llm_generation_profile
from src.ai.tq_quality_gate import evaluate_tq_quality, format_quality_refinement_message
from src.ai.tq_reliability import (
    PIPELINE_STAGE_IDS,
    compute_reliability_summary,
    failure_aware_repair_nudge,
    run_tq_validation_chain,
)
from src.diagnostics.codes import (
    PX_AI_HTTP,
    PX_AI_JSON,
    PX_AI_MAX_RETRIES,
    PX_AI_NO_KEY,
    PX_AI_QUALITY_GATE,
)
from src.diagnostics.formal_phases import annotate_with_formal
from src.benchmarks.token_estimate import ESTIMATOR_ID, estimate_tokens

try:
    from dotenv import load_dotenv

    _repo = Path(__file__).resolve().parents[2]
    load_dotenv(_repo / ".env")
    load_dotenv(_repo / ".env.local")
except ImportError:
    pass


def _tq_quality_gate_effective(cli_or_caller_flag: bool) -> bool:
    if (os.environ.get("TORQA_DISABLE_TQ_QUALITY_GATE") or "").strip().lower() in ("1", "true", "yes"):
        return False
    return bool(cli_or_caller_flag)


def build_tq_generation_system_prompt() -> str:
    return '''You are a TORQA .tq surface generator (tq_v1 only). Output ONE JSON object: {"tq": "<full .tq file as a single string with \\n newlines>"}. No markdown fences, no keys other than "tq".

## Output contract
- The value of "tq" must be the **entire** file, UTF-8, Unix newlines inside the string.
- Do not wrap the JSON in markdown. Do not add commentary outside JSON.

## Strict syntax (parser rejects violations)
1. Optional: `module dotted.lowercase_name` (lowercase keyword `module`).
2. Required: `intent snake_case_only` — underscores, never hyphens in the intent name.
3. Required: `requires a, b, c` — **comma-separated** identifiers only (never space-separated). At least one field must be a "primary" name: not **only** `password` and/or `ip_address`. The first identifier that is not `password` or `ip_address` is the primary (for auth flows often `username` or `email`).
4. Optional: exactly `forbid locked` once (if account-lock semantics apply).
5. Optional: exactly `ensures session.created` before `result` **if and only if** the flow contains `create session`.
6. Required: `result` or `result YourLabel` on its own line before `flow:`.
7. Required: `flow:` then **either**:
   - nothing after `flow:` except end-of-file (empty flow — valid), **or**
   - step lines: each line starts with **exactly two ASCII spaces** (no tabs), then one of:
     - `create session`
     - `emit login_success`
     - `emit login_success when <ident>` / `emit login_success if <ident>` where `<ident>` is in `requires` or is `ip_address`
   No blank lines inside the flow block. No legacy steps (`verify password`, `find user`, etc.).

## Comments
- Before `flow:`: full-line `# ...` allowed.
- Inside `flow:`: only lines beginning with two spaces then `#`.

## JSON envelope (strict)
- The JSON object MUST contain **exactly one** property: `"tq"` (string). No other top-level keys.
- Forbidden sibling keys (reject if you catch yourself adding them): `ir_goal`, `markdown`, `explanation`, `notes`, `reasoning`, `thought`, `file`, `path`, `analysis`, `plan`.
- Put the entire `.tq` file **only** inside the `tq` string value.

## Minimal valid templates (copy shape exactly; adjust names)
Empty flow (safest default when unsure):
```
module generated.user_intent

intent user_flow
requires username, password
result OK

flow:
```

Sign-in with session (only when the user asked for login/session success):
```
module generated.signin

intent sign_in_flow
requires username, password, ip_address
forbid locked
ensures session.created
result SessionReady

flow:
  create session
  emit login_success
```

Landing / lead capture (parser requires `password` in `requires`; P122 needs section comments):
```
# Hero: headline, subcopy, primary CTA
# Trust: logos or testimonial strip (optional second capture below)
module generated.marketing

intent waitlist_page
requires email, password
result LeadCaptured

flow:
```

Follow the **profile checklist** and the **structured plan JSON** in the user message. Prefer a **compact** valid file that still satisfies the profile — **never** sacrifice obvious product structure for token savings (P122).

## Business / enterprise (P118)
When the profile is **crm**, **onboarding**, **approvals**, or **dashboard**, treat the `.tq` as a **dense contract** for a real product: many `requires` identifiers (stages, owners, metrics, deadlines), and **sectioning** via `#` comments for multi-part screens or wizard phases. Multi-step *business* logic must be reflected in `requires` names and comments — only the two standard `flow:` step kinds exist in tq_v1.

## Product quality (P115 / P122)
Shippable specs are not razor-thin: include `module`, a concrete `result` label (not bare `OK` / generic words like `Done` unless the profile truly allows it), enough `requires` fields for the story, and `flow:` steps that match the profile (auth usually needs session creation; full sign-in with audit needs `emit login_success` and `ip_address`). Use `#` section comments so marketing and enterprise surfaces read as real products. **Token-efficient output is valued, but quality gates reject embarrassingly empty shells** — expand until the spec is credible.

## Domain fit (P125)
User messages include **product_domain** and **domain_plan** (JSON). Adapt `requires`, `#` comments, and `result` to that domain: **marketing_site** (zones/CTA/capture), **product_web_app** (screens/inputs/actions), **admin_dashboard** (filters/KPIs/drill-down), **workflow_system** (case/actor/decision ids), **automation_system** (triggers/run/integration ids), **data_pipeline** (source/transform/route/sink lineage). Do not emit the same generic shape when the domain clearly differs — still obey tq_v1 syntax.

## Company operations (P128)
When **company_operations_model** appears in the structured plan JSON, target **enterprise-internal** software: approval chains, onboarding journeys, CRM / service queues, ops dashboards, and regulated document or data pipelines. Encode **statuses, escalation, rejection, retries, ownership, roles, audit/event correlation, and step-to-step data refs** as explicit comma-separated `requires` identifiers (and `#` zones for queue / detail / history / actions). Business steps beyond tq_v1’s two flow primitives stay in `requires` + comments; use `flow:` only for real session/login effects. Prefer outputs that would plausibly drive **admin panels, ops consoles, and process systems** — dense and auditable, not minimal demos.'''


def _extract_tq_from_model_json(text: str) -> str:
    text = (text or "").strip()
    if not text:
        raise ValueError("empty model output")
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in model output")
    obj = json.loads(text[start : end + 1])
    if not isinstance(obj, dict) or "tq" not in obj:
        raise ValueError('JSON must be an object with string field "tq"')
    tq = obj["tq"]
    if not isinstance(tq, str) or not tq.strip():
        raise ValueError('"tq" must be a non-empty string')
    return tq.strip() + ("\n" if not tq.endswith("\n") else "")


def _format_validation_feedback(
    *,
    parse_or_shape_err: Optional[str],
    diagnostics: Optional[Dict[str, Any]],
    summary: str,
) -> str:
    parts: List[str] = []
    if parse_or_shape_err:
        parts.append(f"Parse / shape: {parse_or_shape_err}")
    if summary:
        parts.append(summary)
    issues = (diagnostics or {}).get("issues") if diagnostics else None
    if isinstance(issues, list) and issues:
        parts.append("Diagnostics (fix all that apply):")
        for it in issues[:12]:
            if not isinstance(it, dict):
                continue
            code = it.get("code") or "issue"
            msg = it.get("message") or ""
            parts.append(f"  - [{code}] {msg}")
    return "\n".join(parts) if parts else summary


def validate_tq_text(text: str, *, synthetic_path: Path) -> tuple[bool, Optional[Dict[str, Any]], str]:
    """Returns (ok, diagnostics_or_none, error_message). P127: includes projection emit checks by default."""
    r = run_tq_validation_chain(text, synthetic_path=synthetic_path)
    return r.ok, r.diagnostics, r.error_message


def _aggregate_api_metrics(
    provider: str,
    model_name: str,
    attempts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    total_latency = 0.0
    sp = sc = 0
    http_calls = 0
    for a in attempts:
        lm = a.get("latency_ms")
        if isinstance(lm, (int, float)):
            total_latency += float(lm)
        if "usage" in a:
            u = normalize_usage(a.get("usage"))
            sp += u["prompt_tokens"]
            sc += u["completion_tokens"]
    http_calls = sum(1 for a in attempts if isinstance(a.get("latency_ms"), (int, float)))
    st = sp + sc
    retry_count = max(0, http_calls - 1)
    cost = estimate_openai_cost_usd(model_name, sp, sc) if provider == "openai" else None
    return {
        "provider": provider,
        "model": model_name,
        "http_calls": http_calls,
        "retry_count": retry_count,
        "latency_ms_total": round(total_latency, 3),
        "usage": {
            "prompt_tokens": sp,
            "completion_tokens": sc,
            "total_tokens": st if st else sp + sc,
        },
        "estimated_cost_usd": cost,
        "pricing_note": PRICING_NOTE if provider == "openai" else "estimated_cost_usd is only filled for OpenAI models in this build",
    }


def _finalize_llm_payload(res: Dict[str, Any], profile: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out = dict(res)
    out["llm_comparison_metrics"] = build_llm_comparison_metrics(out)
    if profile is not None:
        out["llm_generation_profile"] = profile
    return out


def _tag_llm_attempt_tier(attempts: List[Any], tier: str) -> None:
    for a in attempts:
        if isinstance(a, dict):
            a.setdefault("llm_attempt_tier", tier)


def _suggest_tq_one_provider(
    user_prompt: str,
    *,
    workspace_root: Path,
    max_retries: int,
    model: Optional[str],
    gen_category: Optional[str],
    llm_provider: str,
    tq_quality_gate: bool = True,
    tq_gen_phases: Optional[int] = None,
    evolution: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    api_key = resolve_llm_api_key(llm_provider)
    if not api_key:
        envn = llm_key_env_name(llm_provider)
        return {
            "ok": False,
            "tq_text": None,
            "attempts": [],
            "api_metrics": _aggregate_api_metrics(
                llm_provider, (model or "").strip() or default_llm_model(llm_provider), []
            ),
            "issues": annotate_with_formal(
                [
                    f"API key not set for provider {llm_provider!r}; set {envn} in the environment "
                    "or configure keys in TORQA Desktop."
                ],
                legacy_phase="ai",
            ),
            "code": PX_AI_NO_KEY,
            "llm_provider": llm_provider,
            "reliability": compute_reliability_summary([], ok=False),
        }

    model_name = (model or "").strip() or default_llm_model(llm_provider)
    if not (user_prompt or "").strip():
        return {
            "ok": False,
            "tq_text": None,
            "attempts": [],
            "api_metrics": _aggregate_api_metrics(llm_provider, model_name, []),
            "issues": annotate_with_formal(
                ["Empty user prompt — describe the product or screen to generate a `.tq` for."],
                legacy_phase="ai",
            ),
            "code": PX_AI_JSON,
            "llm_provider": llm_provider,
            "phase_trace": [],
            "tq_gen_phases": resolve_tq_gen_phases(tq_gen_phases),
            "reliability": compute_reliability_summary([], ok=False),
            "reliability_pipeline": {
                "ordered_stages": list(PIPELINE_STAGE_IDS),
                "note": "Stopped before generation — empty prompt.",
            },
        }

    hints = get_tq_gen_model_hints(model_name)
    system = build_tq_generation_system_prompt() + hints.system_suffix
    synthetic = workspace_root.resolve() / ".torqa_generated_validate.tq"
    attempts: List[Dict[str, Any]] = []
    feedback = ""
    intent_kind = resolve_tq_gen_intent(user_prompt, gen_category)
    surface_kind = infer_surface_kind(user_prompt)
    nl_plan = build_nl_plan(user_prompt, intent_kind, surface_kind)
    product_domain = str(nl_plan.get("product_domain") or "generic")
    machine_plan = build_structured_generation_plan(user_prompt, intent_kind, surface_kind)
    nl_block = format_nl_plan_markdown(nl_plan) + "\n" + format_structured_plan_block(machine_plan)
    structured_base = build_structured_user_message(
        user_prompt,
        intent_kind,
        nl_plan_markdown=nl_block,
    )
    evolution = evolution if isinstance(evolution, dict) else None
    if evolution and evolution.get("prefix"):
        structured_base = str(evolution["prefix"]) + structured_base

    json_mode = llm_provider == "google" or (
        llm_provider == "openai" and json_object_supported(model_name)
    )

    n_phases = resolve_tq_gen_phases(tq_gen_phases)
    rows = phase_rows(n_phases)
    phase_trace: List[Dict[str, Any]] = []
    current_tq: Optional[str] = None
    last_diag: Optional[Dict[str, Any]] = None
    last_quality_score = 0

    def _fail_tail() -> Dict[str, Any]:
        last_qg = next(
            (
                a.get("quality_gate")
                for a in reversed(attempts)
                if isinstance(a, dict) and a.get("status") == "quality_gate"
            ),
            None,
        )
        msg = "Max retries exceeded; .tq still invalid after parse/diagnostics"
        code = PX_AI_MAX_RETRIES
        if last_qg and not (last_qg.get("passed") is True):
            msg = (
                "Max retries exceeded; .tq passed parse/diagnostics but did not reach minimum quality "
                f"(last score {last_qg.get('score')})."
            )
            code = PX_AI_QUALITY_GATE
        tail = {
            "ok": False,
            "tq_text": None,
            "attempts": attempts,
            "api_metrics": _aggregate_api_metrics(llm_provider, model_name, attempts),
            "issues": annotate_with_formal([msg + "."], legacy_phase="ai"),
            "code": code,
            "llm_provider": llm_provider,
            "phase_trace": phase_trace,
            "tq_gen_phases": n_phases,
            "reliability": compute_reliability_summary(attempts, ok=False),
        }
        tail["reliability_pipeline"] = {
            "ordered_stages": list(PIPELINE_STAGE_IDS),
            "note": "Pipeline halted before success; see attempts[].failure_kind and validation_stage.",
        }
        return tail

    for phase_ix, (phase_id, phase_banner, quality_this_phase) in enumerate(rows):
        emit_tq_gen_progress(phase=phase_ix + 1, total=len(rows), phase_id=phase_id, status="started")

        if phase_ix == 0:
            phase_seed = structured_base + (f"\n\n---\n{phase_banner}" if phase_banner.strip() else "")
        else:
            if not current_tq:
                emit_tq_gen_progress(phase=phase_ix + 1, total=len(rows), phase_id=phase_id, status="failed")
                phase_trace.append({"phase": phase_ix + 1, "total": len(rows), "id": phase_id, "ok": False})
                return _fail_tail()
            phase_seed = build_refinement_user_message(
                user_prompt=user_prompt,
                intent_kind=str(intent_kind),
                tq_text=current_tq,
                phase_banner=phase_banner,
                plan_excerpt=nl_block,
            )

        inner_feedback = ""
        phase_done = False
        repair_context_kind: Optional[str] = None
        for attempt in range(max_retries + 1):
            ai = len(attempts)
            if inner_feedback:
                if phase_ix == 0:
                    user_content = (
                        f"{structured_base}\n\n---\n## Repair pass\nFix the previous .tq. Verifier feedback (must be satisfied):\n{inner_feedback}\n"
                        f"Re-emit valid JSON with **only** key \"tq\" (string). Keep profile {intent_kind} unless feedback implies a different shape.\n"
                        f"Do not add forbidden top-level keys listed in the structured plan JSON.\n"
                    )
                else:
                    user_content = (
                        f"{phase_seed}\n\n---\n## Repair pass\nFix the previous .tq. Verifier feedback (must be satisfied):\n{inner_feedback}\n"
                        f"Re-emit valid JSON with **only** key \"tq\" (string). Keep profile {intent_kind}.\n"
                    )
            else:
                user_content = phase_seed

            if inner_feedback:
                temp = hints.temperature_repair
                if repair_context_kind == "prompt_misunderstanding":
                    temp = min(temp, 0.05)
            else:
                temp = hints.temperature_generate
            t0 = time.perf_counter()
            try:
                u_msg = user_content
                if inner_feedback and llm_provider == "anthropic":
                    u_msg = (
                        "[P129 repair] Output **only** a JSON object with a single string field \"tq\". "
                        "No markdown, no preamble.\n\n" + user_content
                    )
                elif inner_feedback and llm_provider == "google":
                    u_msg = (
                        "[P129 repair] Return only JSON: {\"tq\":\"...\"} with no markdown fences or extra keys.\n\n"
                        + user_content
                    )
                msg, usage_raw, resolved_model = chat_completion_text(
                    provider=llm_provider,
                    api_key=api_key,
                    model=model_name,
                    system=system,
                    user=u_msg,
                    temperature=temp,
                    json_mode=json_mode,
                    anthropic_max_tokens=hints.anthropic_max_tokens,
                )
            except urllib.error.HTTPError as ex:
                latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
                err_body = ex.read().decode("utf-8", errors="replace") if ex.fp else ""
                attempts.append(
                    {
                        "attempt": ai,
                        "phase": phase_id,
                        "phase_index": phase_ix + 1,
                        "llm_provider": llm_provider,
                        "error": "http_error",
                        "detail": err_body[:2000],
                        "latency_ms": latency_ms,
                    }
                )
                return {
                    "ok": False,
                    "tq_text": None,
                    "attempts": attempts,
                    "api_metrics": _aggregate_api_metrics(llm_provider, model_name, attempts),
                    "issues": annotate_with_formal(
                        [f"{PX_AI_HTTP}: {ex.code} {err_body[:500]}"], legacy_phase="ai"
                    ),
                    "code": PX_AI_HTTP,
                    "llm_provider": llm_provider,
                    "phase_trace": phase_trace,
                    "tq_gen_phases": n_phases,
                    "reliability": compute_reliability_summary(attempts, ok=False),
                }
            except Exception as ex:
                latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
                attempts.append(
                    {
                        "attempt": ai,
                        "phase": phase_id,
                        "phase_index": phase_ix + 1,
                        "llm_provider": llm_provider,
                        "error": str(ex),
                        "latency_ms": latency_ms,
                    }
                )
                return {
                    "ok": False,
                    "tq_text": None,
                    "attempts": attempts,
                    "api_metrics": _aggregate_api_metrics(llm_provider, model_name, attempts),
                    "issues": annotate_with_formal([str(ex)], legacy_phase="ai"),
                    "code": PX_AI_HTTP,
                    "llm_provider": llm_provider,
                    "phase_trace": phase_trace,
                    "tq_gen_phases": n_phases,
                    "reliability": compute_reliability_summary(attempts, ok=False),
                }

            latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
            usage = normalize_usage(usage_raw)
            model_name = resolved_model or model_name

            try:
                tq_text = _extract_tq_from_model_json(msg)
            except (ValueError, json.JSONDecodeError) as ex:
                repair_context_kind = "prompt_misunderstanding"
                attempts.append(
                    {
                        "attempt": ai,
                        "phase": phase_id,
                        "phase_index": phase_ix + 1,
                        "llm_provider": llm_provider,
                        "parse_error": str(ex),
                        "latency_ms": latency_ms,
                        "usage": usage,
                        "failure_kind": "prompt_misunderstanding",
                        "validation_stage": "tq_generation",
                    }
                )
                fb = _format_validation_feedback(
                    parse_or_shape_err=str(ex),
                    diagnostics=None,
                    summary="Return only a JSON object with a single string field \"tq\".",
                )
                nudge = failure_aware_repair_nudge("prompt_misunderstanding")
                inner_feedback = fb + (f"\n\n{nudge}" if nudge else "")
                continue

            tq_fixed, autofixes = autofix_tq_surface(tq_text)
            chain = run_tq_validation_chain(tq_fixed, synthetic_path=synthetic)
            ok = chain.ok
            diag = chain.diagnostics
            err = chain.error_message
            if ok:
                q_on = _tq_quality_gate_effective(tq_quality_gate and quality_this_phase)
                qres = evaluate_tq_quality(
                    tq_fixed,
                    intent_kind=intent_kind,
                    synthetic_path=synthetic,
                    enabled=q_on,
                    product_domain=product_domain,
                    user_prompt=user_prompt,
                )
                if not qres.passed:
                    repair_context_kind = "low_quality"
                    attempts.append(
                        {
                            "attempt": ai,
                            "phase": phase_id,
                            "phase_index": phase_ix + 1,
                            "llm_provider": llm_provider,
                            "status": "quality_gate",
                            "latency_ms": latency_ms,
                            "usage": usage,
                            "autofixes": autofixes,
                            "failure_kind": "low_quality",
                            "validation_stage": "quality_validation",
                            "quality_gate": {
                                "passed": False,
                                "score": qres.score,
                                "hard_violations": list(qres.hard_violations),
                                "soft_reasons": list(qres.soft_reasons),
                                "dimensions": dict(qres.dimensions),
                                "product_domain": product_domain,
                            },
                        }
                    )
                    qmsg = format_quality_refinement_message(qres, intent_kind=str(intent_kind))
                    nudge = failure_aware_repair_nudge("low_quality")
                    inner_feedback = qmsg + (f"\n\n{nudge}" if nudge else "")
                    continue

                attempts.append(
                    {
                        "attempt": ai,
                        "phase": phase_id,
                        "phase_index": phase_ix + 1,
                        "llm_provider": llm_provider,
                        "status": "ok",
                        "latency_ms": latency_ms,
                        "usage": usage,
                        "autofixes": autofixes,
                        "quality_gate": {
                            "passed": True,
                            "score": qres.score,
                            "dimensions": dict(qres.dimensions),
                            "product_domain": product_domain,
                        },
                    }
                )
                current_tq = tq_fixed
                last_diag = diag
                last_quality_score = int(qres.score)
                phase_trace.append(
                    {
                        "phase": phase_ix + 1,
                        "total": len(rows),
                        "id": phase_id,
                        "ok": True,
                        "quality_score": qres.score,
                    }
                )
                emit_tq_gen_progress(phase=phase_ix + 1, total=len(rows), phase_id=phase_id, status="done")
                phase_done = True
                break

            repair_context_kind = chain.failure_kind
            attempts.append(
                {
                    "attempt": ai,
                    "phase": phase_id,
                    "phase_index": phase_ix + 1,
                    "llm_provider": llm_provider,
                    "validation_error": err,
                    "latency_ms": latency_ms,
                    "usage": usage,
                    "autofixes": autofixes,
                    "failure_kind": chain.failure_kind,
                    "validation_stage": chain.stage_reached,
                }
            )
            fb = _format_validation_feedback(
                parse_or_shape_err=None,
                diagnostics=diag,
                summary=err,
            )
            nudge = failure_aware_repair_nudge(chain.failure_kind)
            inner_feedback = fb + (f"\n\n{nudge}" if nudge else "")

        if not phase_done:
            emit_tq_gen_progress(phase=phase_ix + 1, total=len(rows), phase_id=phase_id, status="failed")
            phase_trace.append({"phase": phase_ix + 1, "total": len(rows), "id": phase_id, "ok": False})
            return _fail_tail()

    if not current_tq or last_diag is None:
        return _fail_tail()

    pt_est = estimate_tokens(user_prompt)
    tq_est = estimate_tokens(current_tq)
    ev_meta = None
    if evolution and isinstance(evolution, dict):
        ev_meta = {k: v for k, v in evolution.items() if k != "prefix"}

    qg_eff = _tq_quality_gate_effective(tq_quality_gate)
    stage_results: List[Dict[str, Any]] = []
    for sid in PIPELINE_STAGE_IDS:
        if sid == "quality_validation" and not qg_eff:
            stage_results.append(
                {
                    "id": sid,
                    "status": "skipped",
                    "reason": "quality_gate_disabled_or_env",
                }
            )
        else:
            stage_results.append({"id": sid, "status": "completed"})

    return {
        "ok": True,
        "tq_text": current_tq,
        "attempts": attempts,
        "api_metrics": _aggregate_api_metrics(llm_provider, model_name, attempts),
        "issues": [],
        "diagnostics": last_diag,
        "tq_gen_intent": intent_kind,
        "tq_gen_surface": surface_kind,
        "tq_gen_model_route": hints.route,
        "generation_plan": machine_plan,
        "llm_provider": llm_provider,
        "tq_quality_score": last_quality_score,
        "phase_trace": phase_trace,
        "tq_gen_phases": n_phases,
        "evolution": ev_meta,
        "reliability": compute_reliability_summary(attempts, ok=True),
        "reliability_pipeline": {
            "ordered_stages": list(PIPELINE_STAGE_IDS),
            "stage_results": stage_results,
            "interpretation": {
                "intent_kind": str(intent_kind),
                "surface_kind": str(surface_kind),
                "product_domain": product_domain,
            },
        },
        "token_hint": {
            "prompt_token_estimate": pt_est,
            "tq_token_estimate": tq_est,
            "reduction_percent": round(100.0 * (1.0 - tq_est / max(1, pt_est)), 2),
            "compression_ratio": round(pt_est / max(1, tq_est), 4),
            "estimator_id": ESTIMATOR_ID,
            "comparison_basis": "nl_prompt",
        },
    }


def suggest_tq_from_prompt(
    user_prompt: str,
    *,
    workspace_root: Path,
    max_retries: Optional[int] = None,
    model: Optional[str] = None,
    gen_category: Optional[str] = None,
    llm_provider: Optional[str] = None,
    llm_fallback: bool = True,
    tq_quality_gate: bool = True,
    tq_gen_phases: Optional[int] = None,
    evolution: Optional[Dict[str, Any]] = None,
    llm_gen_mode: Optional[str] = None,
    fallback_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate validated .tq via configured LLM vendor (OpenAI, Anthropic, or Google Gemini).

    Environment keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY (or GEMINI_API_KEY).
    Default vendor: ``TORQA_LLM_PROVIDER`` or ``openai``. With ``llm_fallback``, failed non-OpenAI
    runs retry once with OpenAI when ``OPENAI_API_KEY`` is set.

    P115 / P122: When ``tq_quality_gate`` is True (default), outputs that pass the parser but are below
    the minimum quality floor trigger automatic refinement passes (weak results are not accepted as final).
    Disable with ``--no-tq-quality-gate`` or env ``TORQA_DISABLE_TQ_QUALITY_GATE=1``.

    P116: Multi-phase generation (default 3: base → structure → polish). Override with
    ``tq_gen_phases`` / ``--tq-gen-phases`` / env ``TORQA_TQ_GEN_PHASES=1``.

    P117: Optional ``evolution`` dict from ``tq_evolve.evolution_dict_for_suggest`` prepends current
    .tq context (improve / add_feature modes).

    P127: Responses include ``reliability`` (first-pass vs repaired success for this run) and
    ``reliability_pipeline`` stage checklist; attempts may carry ``failure_kind`` for structured recovery.
    This does **not** guarantee error-free generation.

    P129: ``llm_gen_mode`` (balanced / cheapest / fastest / highest_quality / most_reliable) adjusts
    default model class, phases, and retries; ``fallback_model`` triggers a same-provider second model
    after the primary exhausts. Responses include ``llm_generation_profile`` and ``llm_comparison_metrics``.
    """
    primary = normalize_llm_provider(llm_provider)
    profile = resolve_llm_generation_profile(
        primary,
        llm_gen_mode,
        explicit_model=model,
        explicit_fallback_model=fallback_model,
        explicit_tq_gen_phases=tq_gen_phases,
        explicit_max_retries=max_retries,
    )
    eff_model = str(profile["primary_model"] or "").strip() or None
    eff_retries = int(profile["max_retries"])
    eff_phases: Optional[int] = int(profile["tq_gen_phases"])
    gate_on = bool(profile.get("tq_quality_gate", True)) and tq_quality_gate

    def _run(mod: Optional[str], prov: str) -> Dict[str, Any]:
        return _suggest_tq_one_provider(
            user_prompt,
            workspace_root=workspace_root,
            max_retries=eff_retries,
            model=mod,
            gen_category=gen_category,
            llm_provider=prov,
            tq_quality_gate=gate_on,
            tq_gen_phases=eff_phases,
            evolution=evolution,
        )

    res = _run(eff_model, primary)
    res = _finalize_llm_payload(res, profile)
    if res.get("ok"):
        return res

    fb = str(profile.get("fallback_model") or "").strip()
    em = str(eff_model or "").strip()
    if (
        fb
        and fb.lower() != em.lower()
        and resolve_llm_api_key(primary)
        and res.get("code") in (PX_AI_MAX_RETRIES, PX_AI_HTTP, PX_AI_QUALITY_GATE)
    ):
        prev = list(res.get("attempts") or [])
        _tag_llm_attempt_tier(prev, "primary_model")
        res2 = _run(fb, primary)
        nxt = list(res2.get("attempts") or [])
        _tag_llm_attempt_tier(nxt, "fallback_same_provider")
        merged = prev + nxt
        res2 = dict(res2)
        res2["attempts"] = merged
        res2["api_metrics"] = _aggregate_api_metrics(primary, fb, merged)
        prof2 = {**profile, "used_fallback_model": fb}
        res2 = _finalize_llm_payload(res2, prof2)
        if res2.get("ok"):
            res2["llm_same_provider_fallback_used"] = True
            res2["llm_primary_model_attempted"] = em
            return res2
        res = res2
    if (
        llm_fallback
        and primary != "openai"
        and resolve_llm_api_key("openai")
        and res.get("code") in (PX_AI_MAX_RETRIES, PX_AI_HTTP, PX_AI_NO_KEY, PX_AI_QUALITY_GATE)
    ):
        prev = list(res.get("attempts") or [])
        for a in prev:
            if isinstance(a, dict) and "llm_attempt_tier" not in a:
                a["llm_attempt_tier"] = "before_openai_fallback"
        fb_oai = _suggest_tq_one_provider(
            user_prompt,
            workspace_root=workspace_root,
            max_retries=eff_retries,
            model=None,
            gen_category=gen_category,
            llm_provider="openai",
            tq_quality_gate=gate_on,
            tq_gen_phases=eff_phases,
            evolution=evolution,
        )
        att_o = list(fb_oai.get("attempts") or [])
        _tag_llm_attempt_tier(att_o, "openai_vendor_fallback")
        merged_o = prev + att_o
        fb_oai = dict(fb_oai)
        fb_oai["attempts"] = merged_o
        om = (fb_oai.get("api_metrics") or {}).get("model") or default_llm_model("openai")
        fb_oai["api_metrics"] = _aggregate_api_metrics("openai", str(om), merged_o)
        prof3 = {**profile, "openai_vendor_fallback_attempted": True}
        fb_oai = _finalize_llm_payload(fb_oai, prof3)
        if fb_oai.get("ok"):
            fb_oai["llm_fallback_used"] = True
            fb_oai["llm_primary_provider"] = primary
            return fb_oai
        return fb_oai
    return res

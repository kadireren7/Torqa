"""
P76/P83: LLM → ``.tq`` surface with parse + full diagnostics loop (no bypass).

Requires OPENAI_API_KEY. Output is validated with ``parse_tq_source`` and ``build_full_diagnostic_report``.
P83: deterministic intent profile (landing / crud / automation / auth / generic), structured user
envelope, and a system prompt aligned with real parser rules (no blanket “must include password”).
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.ai.openai_metrics import PRICING_NOTE, estimate_openai_cost_usd, normalize_usage
from src.ai.tq_intent import build_structured_user_message, resolve_tq_gen_intent
from src.diagnostics.codes import PX_AI_HTTP, PX_AI_MAX_RETRIES, PX_AI_NO_KEY
from src.diagnostics.formal_phases import annotate_with_formal
from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.benchmarks.token_estimate import estimate_tokens
from src.surface.parse_tq import TQParseError, parse_tq_source

try:
    from dotenv import load_dotenv

    _repo = Path(__file__).resolve().parents[2]
    load_dotenv(_repo / ".env")
    load_dotenv(_repo / ".env.local")
except ImportError:
    pass


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

Landing / lead capture (single field, no password unless user asked):
```
module generated.marketing

intent waitlist_page
requires email
result LeadCaptured

flow:
```

Follow the **profile checklist** in the user message for the active generation profile (auth, landing, crud, automation, generic). Prefer the **smallest** valid file that matches the user request.'''


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


def validate_tq_text(text: str, *, synthetic_path: Path) -> tuple[bool, Optional[Dict[str, Any]], str]:
    """Returns (ok, diagnostics_or_none, error_message)."""
    try:
        bundle = parse_tq_source(text, tq_path=synthetic_path)
    except TQParseError as ex:
        return False, None, f"{ex.code}: {ex}"
    try:
        goal = ir_goal_from_json(bundle)
    except Exception as ex:  # noqa: BLE001
        return False, None, f"IR shape: {ex}"
    rep = build_full_diagnostic_report(goal)
    if not rep.get("ok", False):
        parts = [f"{i.get('code')}: {i.get('message')}" for i in (rep.get("issues") or [])[:10]]
        return False, rep, "; ".join(parts) if parts else "diagnostics not ok"
    return True, rep, ""


def _aggregate_api_metrics(model_name: str, attempts: List[Dict[str, Any]]) -> Dict[str, Any]:
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
    cost = estimate_openai_cost_usd(model_name, sp, sc)
    return {
        "provider": "openai",
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
        "pricing_note": PRICING_NOTE,
    }


def suggest_tq_from_prompt(
    user_prompt: str,
    *,
    workspace_root: Path,
    max_retries: int = 3,
    model: Optional[str] = None,
    gen_category: Optional[str] = None,
) -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "ok": False,
            "tq_text": None,
            "attempts": [],
            "issues": annotate_with_formal(
                ["OPENAI_API_KEY is not set; configure the key to generate .tq from prompts."],
                legacy_phase="ai",
            ),
            "code": PX_AI_NO_KEY,
        }

    model_name = model or os.environ.get("OPENAI_IR_MODEL", "gpt-4o-mini")
    system = build_tq_generation_system_prompt()
    synthetic = (workspace_root.resolve() / ".torqa_generated_validate.tq")
    attempts: List[Dict[str, Any]] = []
    feedback = ""
    intent_kind = resolve_tq_gen_intent(user_prompt, gen_category)
    structured_base = build_structured_user_message(user_prompt, intent_kind)

    for attempt in range(max_retries + 1):
        user_content = structured_base
        if feedback:
            user_content = (
                f"{structured_base}\n\n---\n## Repair pass\nFix the previous .tq. Verifier feedback (must be satisfied):\n{feedback}\n"
                f"Re-emit valid JSON with key \"tq\" only. Keep profile {intent_kind} unless feedback implies a different shape.\n"
            )
        body = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.08,
            "response_format": {"type": "json_object"},
        }
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
            err_body = ex.read().decode("utf-8", errors="replace") if ex.fp else ""
            attempts.append(
                {
                    "attempt": attempt,
                    "error": "http_error",
                    "detail": err_body[:2000],
                    "latency_ms": latency_ms,
                }
            )
            return {
                "ok": False,
                "tq_text": None,
                "attempts": attempts,
                "api_metrics": _aggregate_api_metrics(model_name, attempts),
                "issues": annotate_with_formal(
                    [f"{PX_AI_HTTP}: {ex.code} {err_body[:500]}"], legacy_phase="ai"
                ),
                "code": PX_AI_HTTP,
            }
        except Exception as ex:
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
            attempts.append({"attempt": attempt, "error": str(ex), "latency_ms": latency_ms})
            return {
                "ok": False,
                "tq_text": None,
                "attempts": attempts,
                "api_metrics": _aggregate_api_metrics(model_name, attempts),
                "issues": annotate_with_formal([str(ex)], legacy_phase="ai"),
                "code": PX_AI_HTTP,
            }

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
        usage = normalize_usage(raw.get("usage"))
        resp_model = raw.get("model")
        if isinstance(resp_model, str) and resp_model.strip():
            model_name = resp_model.strip()

        try:
            msg = raw["choices"][0]["message"]["content"]
            tq_text = _extract_tq_from_model_json(msg)
        except (KeyError, IndexError, ValueError, json.JSONDecodeError) as ex:
            attempts.append(
                {
                    "attempt": attempt,
                    "parse_error": str(ex),
                    "latency_ms": latency_ms,
                    "usage": usage,
                }
            )
            feedback = f"Model output error: {ex}. Return only JSON with key tq (string)."
            continue

        ok, diag, err = validate_tq_text(tq_text, synthetic_path=synthetic)
        if ok:
            attempts.append(
                {
                    "attempt": attempt,
                    "status": "ok",
                    "latency_ms": latency_ms,
                    "usage": usage,
                }
            )
            pt_est = estimate_tokens(user_prompt)
            tq_est = estimate_tokens(tq_text)
            return {
                "ok": True,
                "tq_text": tq_text,
                "attempts": attempts,
                "api_metrics": _aggregate_api_metrics(model_name, attempts),
                "issues": [],
                "diagnostics": diag,
                "tq_gen_intent": intent_kind,
                "token_hint": {
                    "prompt_token_estimate": pt_est,
                    "tq_token_estimate": tq_est,
                    "reduction_percent": round(100.0 * (1.0 - tq_est / max(1, pt_est)), 2),
                },
            }

        attempts.append(
            {
                "attempt": attempt,
                "validation_error": err,
                "latency_ms": latency_ms,
                "usage": usage,
            }
        )
        feedback = err

    return {
        "ok": False,
        "tq_text": None,
        "attempts": attempts,
        "api_metrics": _aggregate_api_metrics(model_name, attempts),
        "issues": annotate_with_formal(
            ["Max retries exceeded; .tq still invalid after parse/diagnostics."], legacy_phase="ai"
        ),
        "code": PX_AI_MAX_RETRIES,
    }

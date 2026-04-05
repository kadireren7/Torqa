"""
P129: Multi-provider generation strategy — presets, same-provider fallback, and comparison metrics.

TORQA keeps one transport entry point per vendor; this layer picks **models / phases / retries**
and surfaces **telemetry** for desktop and CLI without claiming cross-vendor parity beyond shared
parse + quality gates.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.ai.tq_llm_transport import default_llm_model

LlmGenMode = str  # balanced | cheapest | fastest | highest_quality | most_reliable

_MODE_CHOICES = frozenset({"balanced", "cheapest", "fastest", "highest_quality", "most_reliable"})

_CHEAP = {"openai": "gpt-4o-mini", "anthropic": "claude-3-5-haiku-20241022", "google": "gemini-1.5-flash"}
_QUALITY = {"openai": "gpt-4o", "anthropic": "claude-3-5-sonnet-20241022", "google": "gemini-1.5-pro"}


def normalize_llm_gen_mode(raw: Optional[str]) -> str:
    m = (raw or "").strip().lower()
    if m in _MODE_CHOICES:
        return m
    return "balanced"


def resolve_llm_generation_profile(
    provider: str,
    llm_gen_mode: Optional[str],
    *,
    explicit_model: Optional[str],
    explicit_fallback_model: Optional[str],
    explicit_tq_gen_phases: Optional[int],
    explicit_max_retries: Optional[int],
) -> Dict[str, Any]:
    """
    Returns a JSON-serializable profile. Explicit CLI/UI args for phases and max_retries **override**
    mode defaults when provided (not None).
    """
    mode = normalize_llm_gen_mode(llm_gen_mode)
    p = provider if provider in ("openai", "anthropic", "google") else "openai"

    if mode == "balanced":
        primary = (explicit_model or "").strip() or default_llm_model(p)
        phases = explicit_tq_gen_phases if explicit_tq_gen_phases is not None else 3
        retries = explicit_max_retries if explicit_max_retries is not None else 3
    elif mode in ("cheapest", "fastest"):
        primary = (explicit_model or "").strip() or _CHEAP.get(p, default_llm_model(p))
        phases = explicit_tq_gen_phases if explicit_tq_gen_phases is not None else 1
        retries = explicit_max_retries if explicit_max_retries is not None else 2
    elif mode == "highest_quality":
        primary = (explicit_model or "").strip() or _QUALITY.get(p, default_llm_model(p))
        phases = explicit_tq_gen_phases if explicit_tq_gen_phases is not None else 3
        retries = explicit_max_retries if explicit_max_retries is not None else 4
    elif mode == "most_reliable":
        primary = (explicit_model or "").strip() or _QUALITY.get(p, default_llm_model(p))
        phases = explicit_tq_gen_phases if explicit_tq_gen_phases is not None else 3
        retries = explicit_max_retries if explicit_max_retries is not None else 5
    else:
        primary = (explicit_model or "").strip() or default_llm_model(p)
        phases = explicit_tq_gen_phases if explicit_tq_gen_phases is not None else 3
        retries = explicit_max_retries if explicit_max_retries is not None else 3

    fb = (explicit_fallback_model or "").strip()
    auto_fb = ""
    if mode == "most_reliable" and not fb:
        pl = primary.lower()
        if p == "openai" and "mini" in pl:
            auto_fb = "gpt-4o"
        elif p == "anthropic" and "haiku" in pl:
            auto_fb = "claude-3-5-sonnet-20241022"
        elif p == "google" and "flash" in pl:
            auto_fb = "gemini-1.5-pro"
    effective_fallback = fb or auto_fb

    return {
        "version": 1,
        "mode": mode,
        "provider": p,
        "primary_model": primary,
        "fallback_model": effective_fallback,
        "tq_gen_phases": max(1, min(3, int(phases))),
        "max_retries": max(0, int(retries)),
        "tq_quality_gate": True,
    }


def build_llm_comparison_metrics(result: Dict[str, Any]) -> Dict[str, Any]:
    """Per-run metrics for validity, cost, latency, tokens, and quality (P129)."""
    ok = bool(result.get("ok"))
    attempts: List[Any] = list(result.get("attempts") or [])
    am = result.get("api_metrics") if isinstance(result.get("api_metrics"), dict) else {}
    usage = am.get("usage") if isinstance(am.get("usage"), dict) else {}
    http_calls = int(am.get("http_calls") or 0)
    success_attempts = sum(1 for a in attempts if isinstance(a, dict) and a.get("status") == "ok")
    partial_validity = (success_attempts / max(1, len(attempts))) if attempts else (1.0 if ok else 0.0)
    return {
        "validity_ok": ok,
        "validity_rate": 1.0 if ok else 0.0,
        "attempt_partial_validity_rate": round(partial_validity, 4),
        "http_calls": http_calls,
        "retry_count": am.get("retry_count"),
        "time_to_success_ms": am.get("latency_ms_total") if ok else None,
        "latency_ms_total": am.get("latency_ms_total"),
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "total_tokens": usage.get("total_tokens"),
        "estimated_cost_usd": am.get("estimated_cost_usd"),
        "pricing_note": am.get("pricing_note"),
        "quality_score": result.get("tq_quality_score"),
        "provider": am.get("provider"),
        "model": am.get("model"),
        "llm_fallback_used": bool(result.get("llm_fallback_used")),
        "llm_same_provider_fallback_used": bool(result.get("llm_same_provider_fallback_used")),
    }

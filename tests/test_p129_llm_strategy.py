"""P129: multi-provider generation presets and comparison metrics."""

from __future__ import annotations

from src.ai.tq_llm_strategy import (
    build_llm_comparison_metrics,
    normalize_llm_gen_mode,
    resolve_llm_generation_profile,
)


def test_normalize_llm_gen_mode() -> None:
    assert normalize_llm_gen_mode(None) == "balanced"
    assert normalize_llm_gen_mode("CHEAPEST") == "cheapest"


def test_resolve_cheapest_openai_uses_mini_and_single_phase() -> None:
    p = resolve_llm_generation_profile(
        "openai",
        "cheapest",
        explicit_model=None,
        explicit_fallback_model=None,
        explicit_tq_gen_phases=None,
        explicit_max_retries=None,
    )
    assert p["primary_model"] == "gpt-4o-mini"
    assert p["tq_gen_phases"] == 1
    assert p["max_retries"] == 2


def test_explicit_model_overrides_mode_primary() -> None:
    p = resolve_llm_generation_profile(
        "openai",
        "cheapest",
        explicit_model="gpt-4o",
        explicit_fallback_model=None,
        explicit_tq_gen_phases=None,
        explicit_max_retries=None,
    )
    assert p["primary_model"] == "gpt-4o"


def test_explicit_max_retries_overrides_mode() -> None:
    p = resolve_llm_generation_profile(
        "anthropic",
        "most_reliable",
        explicit_model=None,
        explicit_fallback_model=None,
        explicit_tq_gen_phases=None,
        explicit_max_retries=2,
    )
    assert p["max_retries"] == 2


def test_most_reliable_auto_fallback_for_mini() -> None:
    p = resolve_llm_generation_profile(
        "openai",
        "most_reliable",
        explicit_model="gpt-4o-mini",
        explicit_fallback_model=None,
        explicit_tq_gen_phases=None,
        explicit_max_retries=None,
    )
    assert p["fallback_model"] == "gpt-4o"


def test_build_llm_comparison_metrics_shape() -> None:
    m = build_llm_comparison_metrics(
        {
            "ok": True,
            "tq_quality_score": 72,
            "attempts": [{"status": "ok"}],
            "api_metrics": {
                "http_calls": 1,
                "retry_count": 0,
                "latency_ms_total": 120.0,
                "estimated_cost_usd": 0.001,
                "provider": "openai",
                "model": "gpt-4o-mini",
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            },
        }
    )
    assert m["validity_ok"] is True
    assert m["quality_score"] == 72
    assert m["prompt_tokens"] == 10

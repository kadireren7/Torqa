"""OpenAI usage → approximate USD (table + env override)."""

from __future__ import annotations

import os

from src.ai.openai_metrics import estimate_openai_cost_usd, normalize_usage, resolve_model_rates


def test_normalize_usage_empty():
    assert normalize_usage(None) == {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


def test_normalize_usage_openai_shape():
    u = normalize_usage({"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150})
    assert u == {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}


def test_estimate_gpt_4o_mini():
    c = estimate_openai_cost_usd("gpt-4o-mini", 1_000_000, 1_000_000)
    assert c is not None
    assert abs(c - (0.15 + 0.60)) < 1e-5


def test_env_override_rates(monkeypatch):
    monkeypatch.setenv("TORQA_OPENAI_INPUT_PER_MTOK_USD", "1")
    monkeypatch.setenv("TORQA_OPENAI_OUTPUT_PER_MTOK_USD", "2")
    inp, out, src = resolve_model_rates("anything")
    assert src == "env_override"
    assert inp == 1.0 and out == 2.0
    c = estimate_openai_cost_usd("unknown-model-xyz", 1_000_000, 500_000)
    assert c is not None
    assert abs(c - (1.0 + 1.0)) < 1e-5
    monkeypatch.delenv("TORQA_OPENAI_INPUT_PER_MTOK_USD", raising=False)
    monkeypatch.delenv("TORQA_OPENAI_OUTPUT_PER_MTOK_USD", raising=False)


def test_unknown_model_no_cost():
    assert estimate_openai_cost_usd("totally-unknown-model", 100, 100) is None

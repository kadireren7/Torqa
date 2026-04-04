"""
Approximate OpenAI Chat Completions cost from reported ``usage`` (USD).

Prices are **indicative**; override per-million-token rates with env when your
invoice model differs:

- ``TORQA_OPENAI_INPUT_PER_MTOK_USD`` — input (prompt) USD per 1M tokens
- ``TORQA_OPENAI_OUTPUT_PER_MTOK_USD`` — output (completion) USD per 1M tokens

When set, these override the built-in table for any model name.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

# (input_usd_per_1M_tokens, output_usd_per_1M_tokens) — update when platform pricing changes.
_MODEL_PRICE_USD_PER_MTOK: Dict[str, Tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-4": (30.00, 60.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    "o1-mini": (1.10, 4.40),
    "o1": (15.00, 60.00),
}

PRICING_NOTE = (
    "estimated_cost_usd uses bundled per-1M token rates or TORQA_OPENAI_*_PER_MTOK_USD; "
    "verify against https://openai.com/api/pricing/"
)


def _env_override_rates() -> Optional[Tuple[float, float]]:
    inp = os.environ.get("TORQA_OPENAI_INPUT_PER_MTOK_USD", "").strip()
    out = os.environ.get("TORQA_OPENAI_OUTPUT_PER_MTOK_USD", "").strip()
    if not inp or not out:
        return None
    try:
        return (float(inp), float(out))
    except ValueError:
        return None


def resolve_model_rates(model: str) -> Tuple[Optional[float], Optional[float], str]:
    """
    Returns (input_per_mtok, output_per_mtok, source_label).
    """
    o = _env_override_rates()
    if o is not None:
        return o[0], o[1], "env_override"
    key = (model or "").strip().lower()
    for name, rates in _MODEL_PRICE_USD_PER_MTOK.items():
        if key == name or key.startswith(f"{name}-"):
            return rates[0], rates[1], f"table:{name}"
    return None, None, "unknown_model"


def estimate_openai_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    inp_r, out_r, _src = resolve_model_rates(model)
    if inp_r is None or out_r is None:
        return None
    pt = max(0, int(prompt_tokens))
    ct = max(0, int(completion_tokens))
    return round((pt / 1_000_000.0) * inp_r + (ct / 1_000_000.0) * out_r, 6)


def normalize_usage(usage: Any) -> Dict[str, int]:
    if not isinstance(usage, dict):
        return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    pt = usage.get("prompt_tokens")
    ct = usage.get("completion_tokens")
    tt = usage.get("total_tokens")
    pi = int(pt) if isinstance(pt, int) else 0
    ci = int(ct) if isinstance(ct, int) else 0
    ti = int(tt) if isinstance(tt, int) else (pi + ci)
    return {"prompt_tokens": pi, "completion_tokens": ci, "total_tokens": ti}

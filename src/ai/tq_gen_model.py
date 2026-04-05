"""
P113 / P123: Model-aware generation hints (temperature, prompt nudges) keyed off model id strings.

The chat path is OpenAI-compatible today; ids like ``gpt-4o-mini`` or proxy routes that embed
``claude`` / ``gemini`` still benefit from tuned instructions and temperatures.

P123: Per-vendor output-discipline blocks keep JSON shape stable; validation, repair retries, and
the P122 quality floor are identical regardless of provider.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ModelRoute = Literal["openai", "anthropic", "google", "default"]


@dataclass(frozen=True)
class TqGenModelHints:
    route: ModelRoute
    temperature_generate: float
    temperature_repair: float
    system_suffix: str
    # P129: Anthropic messages API max_tokens (higher for Sonnet-class long .tq JSON).
    anthropic_max_tokens: int = 8192


def classify_tq_model_route(model: str) -> ModelRoute:
    m = (model or "").strip().lower()
    if not m:
        return "default"
    if "claude" in m or m.startswith("anthropic") or "/claude" in m:
        return "anthropic"
    if "gemini" in m or "google/" in m or m.startswith("gemini-"):
        return "google"
    if "gpt" in m or m.startswith("o1") or m.startswith("o3") or m.startswith("o4") or "davinci" in m:
        return "openai"
    return "default"


def get_tq_gen_model_hints(model: str) -> TqGenModelHints:
    route = classify_tq_model_route(model)
    if route == "anthropic":
        mlow = (model or "").lower()
        amax = 16384 if "sonnet" in mlow else 8192
        return TqGenModelHints(
            route=route,
            temperature_generate=0.12,
            temperature_repair=0.0,
            anthropic_max_tokens=amax,
            system_suffix=(
                "\n\n## Output discipline (Claude-style models)\n"
                "- Emit one JSON object only. No <thinking>, no XML, no preamble or postscript.\n"
                "- The object must have exactly one key: \"tq\". No sibling keys.\n"
                "- Inside \"tq\", use Unix newlines (\\n). No markdown fences inside the string.\n"
                "- Same TORQA parser, diagnostics, and P122 quality floor as other vendors — "
                "do not strip structure to minimize tokens.\n"
            ),
        )
    if route == "google":
        return TqGenModelHints(
            route=route,
            temperature_generate=0.1,
            temperature_repair=0.0,
            anthropic_max_tokens=8192,
            system_suffix=(
                "\n\n## Output discipline (Gemini-style models)\n"
                "- Return a single raw JSON object. Do not wrap the response in ``` fences.\n"
                "- Top-level must be only {\"tq\": \"...\"} — no \"thought\", \"analysis\", or extra keys.\n"
                "- Same TORQA parser, diagnostics, and P122 quality floor as other vendors — "
                "keep the spec product-complete.\n"
            ),
        )
    if route == "openai":
        return TqGenModelHints(
            route=route,
            temperature_generate=0.08,
            temperature_repair=0.05,
            anthropic_max_tokens=8192,
            system_suffix=(
                "\n\n## Output discipline (GPT-style models)\n"
                "- You already use json_object mode: still avoid any keys besides \"tq\".\n"
                "- Do not echo the user message or checklist inside \"tq\".\n"
                "- Same TORQA parser, diagnostics, and P122 quality floor as other vendors.\n"
            ),
        )
    return TqGenModelHints(
        route="default",
        temperature_generate=0.1,
        temperature_repair=0.05,
        anthropic_max_tokens=8192,
        system_suffix=(
            "\n\n## Output discipline\n"
            "- Single JSON object, single key \"tq\". No other top-level keys.\n"
            "- Same TORQA parser, diagnostics, and P122 quality floor as named-vendor routes.\n"
        ),
    )


def json_object_supported(model: str) -> bool:
    """
    Conservative gate: most OpenAI chat models accept response_format json_object.
    Disable for unknown/custom ids that often 400 (caller can still parse JSON from text).
    """
    m = (model or "").strip().lower()
    if not m:
        return True
    if classify_tq_model_route(model) in ("anthropic", "google"):
        return False
    if m.startswith("o1") or m.startswith("o3") or m.startswith("o4"):
        return False
    return True

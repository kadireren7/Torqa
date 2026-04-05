"""
P114: Multi-vendor chat HTTP transport for .tq generation (OpenAI, Anthropic, Google Gemini).

Returns assistant text + usage shaped like OpenAI ``usage`` for ``normalize_usage``.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

LlmProviderId = str  # openai | anthropic | google


def normalize_llm_provider(raw: Optional[str]) -> str:
    p = (raw or os.environ.get("TORQA_LLM_PROVIDER") or "openai").strip().lower()
    if p in ("openai", "anthropic", "google"):
        return p
    return "openai"


def resolve_llm_api_key(provider: LlmProviderId) -> str:
    if provider == "openai":
        return os.environ.get("OPENAI_API_KEY", "").strip()
    if provider == "anthropic":
        return os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if provider == "google":
        return (
            os.environ.get("GOOGLE_API_KEY", "").strip()
            or os.environ.get("GEMINI_API_KEY", "").strip()
        )
    return ""


def default_llm_model(provider: LlmProviderId) -> str:
    if provider == "openai":
        return os.environ.get("OPENAI_IR_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    if provider == "anthropic":
        return os.environ.get("TORQA_ANTHROPIC_MODEL", "claude-3-5-haiku-20241022").strip()
    if provider == "google":
        return os.environ.get("TORQA_GEMINI_MODEL", "gemini-1.5-flash").strip()
    return "gpt-4o-mini"


def llm_key_env_name(provider: LlmProviderId) -> str:
    if provider == "openai":
        return "OPENAI_API_KEY"
    if provider == "anthropic":
        return "ANTHROPIC_API_KEY"
    if provider == "google":
        return "GOOGLE_API_KEY or GEMINI_API_KEY"
    return "OPENAI_API_KEY"


def _post_json(url: str, headers: Dict[str, str], body: dict, timeout: int = 120) -> Tuple[dict, float]:
    t0 = time.perf_counter()
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    ms = round((time.perf_counter() - t0) * 1000.0, 3)
    return raw, ms


def chat_completion_text(
    *,
    provider: LlmProviderId,
    api_key: str,
    model: str,
    system: str,
    user: str,
    temperature: float,
    json_mode: bool,
    anthropic_max_tokens: Optional[int] = None,
) -> Tuple[str, Dict[str, int], str]:
    """
    Returns (assistant_text, usage_dict_for_normalize_usage, resolved_model_id).

    Raises urllib.error.HTTPError or KeyError/ValueError on bad payloads.
    """
    if provider == "openai":
        body: Dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        raw, _ms = _post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {api_key}"},
            body,
        )
        u = raw.get("usage") or {}
        usage = {
            "prompt_tokens": int(u.get("prompt_tokens") or 0),
            "completion_tokens": int(u.get("completion_tokens") or 0),
            "total_tokens": int(u.get("total_tokens") or 0),
        }
        text = raw["choices"][0]["message"]["content"]
        mid = raw.get("model") or model
        return str(text), usage, str(mid)

    if provider == "anthropic":
        body = {
            "model": model,
            "max_tokens": int(anthropic_max_tokens) if anthropic_max_tokens is not None else 8192,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "temperature": temperature,
        }
        raw, _ms = _post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            body,
        )
        u = raw.get("usage") or {}
        usage = {
            "prompt_tokens": int(u.get("input_tokens") or 0),
            "completion_tokens": int(u.get("output_tokens") or 0),
            "total_tokens": int(u.get("input_tokens") or 0) + int(u.get("output_tokens") or 0),
        }
        blocks = raw.get("content") or []
        if not blocks or not isinstance(blocks, list):
            raise ValueError("anthropic: missing content")
        parts = []
        for b in blocks:
            if isinstance(b, dict) and b.get("type") == "text":
                parts.append(str(b.get("text") or ""))
        text = "".join(parts)
        return text, usage, model

    if provider == "google":
        # Gemini REST: systemInstruction + generateContent
        safe_model = model.strip()
        if safe_model.startswith("models/"):
            safe_model = safe_model.split("/", 1)[1]
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{safe_model}:generateContent?key={urllib.parse.quote(api_key)}"
        )
        gen_cfg: Dict[str, Any] = {"temperature": temperature}
        if json_mode:
            gen_cfg["responseMimeType"] = "application/json"
        gem_body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": gen_cfg,
        }
        raw, _ms = _post_json(url, {}, gem_body)
        um = raw.get("usageMetadata") or {}
        usage = {
            "prompt_tokens": int(um.get("promptTokenCount") or 0),
            "completion_tokens": int(um.get("candidatesTokenCount") or 0),
            "total_tokens": int(um.get("totalTokenCount") or 0),
        }
        cands = raw.get("candidates") or []
        if not cands:
            raise ValueError("gemini: no candidates")
        parts = cands[0].get("content", {}).get("parts") or []
        if not parts:
            raise ValueError("gemini: empty parts")
        text = str(parts[0].get("text") or "")
        return text, usage, safe_model

    raise ValueError(f"unknown provider {provider!r}")

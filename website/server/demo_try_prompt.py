"""
Public marketing demo: NL prompt -> inferred profile + illustrative .tq template + token estimates.

No LLM call — safe for rate-limited site traffic. Copy says clearly this is illustrative vs desktop/CLI generation.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from src.ai.tq_intent import normalize_prompt_text, resolve_tq_gen_intent
from src.benchmarks.token_estimate import ESTIMATOR_ID, estimate_tokens

# Validated repo templates chosen to match generation profiles (shape hints only).
_INTENT_TEMPLATE: Dict[str, str] = {
    "auth": "examples/torqa/templates/login_flow.tq",
    "landing": "examples/torqa/templates/minimal.tq",
    "crud": "examples/torqa/templates/minimal_form.tq",
    "automation": "examples/torqa/templates/guarded_session.tq",
    "generic": "examples/torqa/templates/minimal.tq",
}


def build_try_prompt_preview(repo_root: Path, raw_prompt: str) -> Dict[str, Any]:
    repo_root = repo_root.resolve()
    prompt = normalize_prompt_text(raw_prompt)
    if not prompt:
        return {"ok": False, "message": "empty prompt"}

    intent = resolve_tq_gen_intent(prompt, None)
    rel = _INTENT_TEMPLATE.get(intent, _INTENT_TEMPLATE["generic"])
    tq_path = (repo_root / rel).resolve()
    if not tq_path.is_file():
        return {"ok": False, "message": f"template missing: {rel}"}

    tq_source = tq_path.read_text(encoding="utf-8")
    pt = estimate_tokens(prompt)
    tt = estimate_tokens(tq_source)
    ratio = round(pt / max(1, tt), 6)
    red = round(100.0 * (1.0 - tt / max(1, pt)), 2) if pt > 0 else None

    return {
        "ok": True,
        "estimator_id": ESTIMATOR_ID,
        "tq_gen_intent": intent,
        "template_relative_path": rel.replace("\\", "/"),
        "prompt_token_estimate": pt,
        "tq_token_estimate": tt,
        "compression_ratio_prompt_per_tq": ratio,
        "reduction_percent_vs_prompt": red,
        "tq_source_preview": tq_source,
        "disclaimer_en": (
            "Illustrative only: this .tq is a fixed validated template for the inferred profile, not an LLM-generated "
            "surface. For tailored output, use TORQA Desktop or CLI with OPENAI_API_KEY."
        ),
    }

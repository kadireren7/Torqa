"""
P117: User-message envelope for evolving an existing .tq (improve / add feature).
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

EvolveMode = Literal["improve", "add_feature"]


def normalize_evolve_mode(raw: Optional[str]) -> Optional[EvolveMode]:
    if not raw:
        return None
    s = str(raw).strip().lower().replace("-", "_")
    if s == "improve":
        return "improve"
    if s in ("add_feature", "addfeature"):
        return "add_feature"
    return None


def build_evolution_envelope(
    *,
    mode: EvolveMode,
    source_rel: str,
    edition: int,
    current_tq: str,
) -> str:
    """Prepended to the normal structured user message."""
    instr = (
        "Refine UX, structure, flow, and labels to match the change request. "
        "Keep the same product intent unless the user explicitly pivots."
        if mode == "improve"
        else "Extend the specification: add the requested fields, flow steps, guards, or outcomes. "
        "Integrate with the existing story; do not remove behavior unless the user asked to drop it."
    )
    body = (current_tq or "").rstrip()
    if len(body) > 48_000:
        body = body[:48_000] + "\n# …(truncated for context limit)…\n"
    mode_tag = "improve" if mode == "improve" else "add_feature"
    return (
        f"## P117 — Evolve project (target edition v{edition})\n"
        f"**Mode:** `{mode_tag}`\n"
        f"**Source file:** `{source_rel}`\n\n"
        f"### Task\n{instr}\n\n"
        f"### Current .tq (emit a full replacement; must stay valid tq_v1)\n```\n{body}\n```\n\n"
        "---\n\n"
    )


def evolution_dict_for_suggest(
    *,
    mode: EvolveMode,
    source_rel: str,
    edition: int,
    current_tq: str,
) -> Dict[str, Any]:
    return {
        "mode": mode,
        "source_rel": source_rel.replace("\\", "/"),
        "edition": int(edition),
        "prefix": build_evolution_envelope(
            mode=mode,
            source_rel=source_rel.replace("\\", "/"),
            edition=edition,
            current_tq=current_tq,
        ),
    }

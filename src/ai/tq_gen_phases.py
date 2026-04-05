"""
P116: Multi-step .tq generation (base → structure → polish).

Phase count: 1 (legacy single pass), 2 (base + refine), or 3 (full assistant-style).
Progress lines are written to stderr as ``TORQA_PROGRESS_JSON:{...}\\n`` for UIs that capture stderr.
"""

from __future__ import annotations

import json
import os
import sys
from typing import List, Tuple

# (phase_id, banner_markdown, use_quality_gate_this_phase)
PhaseRow = Tuple[str, str, bool]

_PHASES_1: List[PhaseRow] = [
    ("single", "", True),
]

_PHASES_2: List[PhaseRow] = [
    (
        "base",
        "## P116 Phase 1/2 — Base spec\n"
        "Produce a **valid** tq_v1 `.tq` that matches the user story and profile. "
        "It may be minimal but must parse; later passes will expand it.",
        False,
    ),
    (
        "refine",
        "## P116 Phase 2/2 — Structure & polish\n"
        "Improve structure: complete `module`, `requires`, `flow:`, `ensures`/`forbid` as needed, "
        "section `#` comments, and a concrete `result` label. Preserve the same product intent.",
        True,
    ),
]

_PHASES_3: List[PhaseRow] = [
    (
        "base",
        "## P116 Phase 1/3 — Base spec\n"
        "Draft a **valid** tq_v1 `.tq` for the user story and profile. Focus on correctness over polish.",
        False,
    ),
    (
        "structure",
        "## P116 Phase 2/3 — Structure pass\n"
        "Expand missing pieces: `module`, richer `requires`, full `flow:` where the story needs it, "
        "`ensures`/`forbid` when auth applies, and helpful `#` comments. Same intent as before.",
        True,
    ),
    (
        "polish",
        "## P116 Phase 3/3 — Layout & logic\n"
        "Polish for downstream UI: clearer `result` wording, sensible flow ordering, "
        "comments that hint at screens/navigation. Do not remove required parser elements.",
        True,
    ),
]

_TABLE = {1: _PHASES_1, 2: _PHASES_2, 3: _PHASES_3}


def resolve_tq_gen_phases(cli_value: int | None) -> int:
    """
    Effective phase count: CLI wins, else ``TORQA_TQ_GEN_PHASES`` env (1–3), else **3** (P116 default).
    """
    env_raw = (os.environ.get("TORQA_TQ_GEN_PHASES") or "").strip().lower()
    if env_raw.isdigit():
        return max(1, min(3, int(env_raw)))
    if cli_value is not None:
        return max(1, min(3, int(cli_value)))
    return 3


def phase_rows(count: int) -> List[PhaseRow]:
    return list(_TABLE[max(1, min(3, count))])


def emit_tq_gen_progress(*, phase: int, total: int, phase_id: str, status: str) -> None:
    """Emit one machine-readable progress line (stderr)."""
    try:
        payload = {"kind": "tq_gen_phase", "phase": phase, "total": total, "id": phase_id, "status": status}
        sys.stderr.write("TORQA_PROGRESS_JSON:" + json.dumps(payload, separators=(",", ":")) + "\n")
        sys.stderr.flush()
    except OSError:
        pass


def build_refinement_user_message(
    *,
    user_prompt: str,
    intent_kind: str,
    tq_text: str,
    phase_banner: str,
    plan_excerpt: str,
) -> str:
    """User message for phase 2+ (current .tq + instructions)."""
    excerpt = (plan_excerpt or "").strip()
    if len(excerpt) > 8000:
        excerpt = excerpt[:8000] + "\n…(truncated)…"
    return (
        f"## Original user request (keep intent)\n{user_prompt.strip()}\n\n"
        f"## Generation profile\n`{intent_kind}`\n\n"
        f"## Structured plan reference (do not emit as top-level JSON; output only {{\"tq\":\"...\"}})\n{excerpt}\n\n"
        f"---\n## Current validated .tq (replace entirely; must remain valid tq_v1)\n```\n{tq_text.rstrip()}\n```\n---\n\n"
        f"{phase_banner}\n\n"
        'Re-emit **only** a JSON object with a single string field `"tq"` containing the full `.tq` file.'
    )

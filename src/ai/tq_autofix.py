"""
P113: Deterministic .tq surface fixes before parse (safe, minimal).

Reduces retry churn for common LLM slip-ups without weakening the parser contract.
"""

from __future__ import annotations

import re
from typing import List, Tuple

_INTENT_LINE = re.compile(r"^(intent\s+)([^\n]+)$", re.MULTILINE)
# Two bare identifiers after requires (no comma) on a single line
_REQUIRES_TWO = re.compile(r"^requires\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$", re.MULTILINE)


def autofix_tq_surface(text: str) -> Tuple[str, List[str]]:
    """
    Apply safe normalizations. Returns (new_text, list of fix ids for telemetry).
    """
    fixes: List[str] = []
    if not text:
        return text, fixes

    s = text.replace("\r\n", "\n").replace("\r", "\n")
    if s.startswith("\ufeff"):
        s = s.lstrip("\ufeff")
        fixes.append("strip_bom")

    def _intent_sub(m: re.Match[str]) -> str:
        prefix, rest = m.group(1), m.group(2).strip()
        if "-" in rest:
            fixes.append("intent_hyphens_to_underscores")
            return prefix + rest.replace("-", "_")
        return m.group(0)

    s2 = _INTENT_LINE.sub(_intent_sub, s)

    def _req_two(m: re.Match[str]) -> str:
        fixes.append("requires_insert_comma_two_ids")
        return f"requires {m.group(1)}, {m.group(2)}"

    s3 = _REQUIRES_TWO.sub(_req_two, s2)

    s4, n = _strip_blank_lines_in_flow(s3)
    if n:
        fixes.append("flow_remove_blank_lines")

    s5 = s4.rstrip() + "\n" if s4.strip() else s4
    return s5, fixes


def _strip_blank_lines_in_flow(s: str) -> Tuple[str, int]:
    lines = s.split("\n")
    out: List[str] = []
    in_flow = False
    removed = 0
    for line in lines:
        stripped = line.strip()
        if stripped == "flow:" or (stripped.startswith("flow:") and not stripped.startswith("flow: ")):
            in_flow = True
            out.append(line)
            continue
        if in_flow:
            if stripped == "":
                removed += 1
                continue
            if stripped.startswith("#") and line.startswith("  "):
                out.append(line)
                continue
            if stripped and not line.startswith("  "):
                in_flow = False
        out.append(line)
    if removed == 0:
        return s, 0
    return "\n".join(out), removed

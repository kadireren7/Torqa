"""
Short fix hints + doc pointers for frequent diagnostic codes (web UI / CLI).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class HintPayload(TypedDict, total=False):
    hint: str
    doc: str


HINTS_BY_CODE: Dict[str, HintPayload] = {
    "PX_IR_GOAL_EMPTY": {
        "hint": "Set ir_goal.goal to a non-empty PascalCase ASCII identifier (e.g. UserLoginFlow).",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_IR_METADATA": {
        "hint": "Ensure ir_goal.metadata includes ir_version (must match toolchain), source, and canonical_language.",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_SEM_UNKNOWN_FUNCTION": {
        "hint": "Use only names from default_ir_function_registry; run `torqa language` for the current list.",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_SEM_UNKNOWN_EFFECT": {
        "hint": "Transition effect_name must be a void builtin with matching arity; see `torqa language`.",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_IR_CONDITION_ID_COLLISION": {
        "hint": "condition_id values must be unique across preconditions, forbids, and postconditions.",
        "doc": "docs/FORMAL_CORE.md#43-well-formedness-phase",
    },
    "PX_PARSE_FAILED": {
        "hint": "Expected a single JSON object IR bundle (see spec/IR_BUNDLE.schema.json). For a minimal template run `torqa language --minimal-json`.",
        "doc": "spec/IR_BUNDLE.schema.json",
    },
    "PX_SEM_ARITY": {
        "hint": "Argument count must match the builtin signature; run `torqa language` for arity per function.",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_SEM_TYPE": {
        "hint": "Expression types must match declared input/semantic types; check bound inputs and literals.",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_SEM_UNDEFINED_IDENT": {
        "hint": "Use only names declared in ir_goal.inputs (and builtins from `torqa language`).",
        "doc": "docs/FORMAL_CORE.md#42-kind--type-phase",
    },
    "PX_HANDOFF": {
        "hint": "Handoff rules require ASCII identifiers and supported operators in expressions; simplify or adjust literals.",
        "doc": "docs/FORMAL_CORE.md",
    },
    "PX_IR_SEMANTIC_DETERMINISM": {
        "hint": "Remove ambiguous or non-deterministic expression patterns required by the IR contract.",
        "doc": "docs/FORMAL_CORE.md#43-well-formedness-phase",
    },
    "PX_SEM_FORBID_GUARANTEE": {
        "hint": "Forbids must be checkable in the before-state; add a precondition that establishes needed facts.",
        "doc": "docs/FORMAL_CORE.md#43-well-formedness-phase",
    },
    "PX_SEM_TRANSITION_READ": {
        "hint": "A transition reads world state that must be guaranteed before it runs; add matching preconditions.",
        "doc": "docs/FORMAL_CORE.md#43-well-formedness-phase",
    },
    # --- .tq surface (representative PX_TQ_*; unknown codes fall back to tq_parse_extras default) ---
    "PX_TQ_UNKNOWN_FLOW_STEP": {
        "hint": "Use only supported flow verbs for this surface; compare with examples/workspace_minimal/app.tq.",
        "doc": "examples/workspace_minimal/README.md",
    },
    "PX_TQ_UNRECOGNIZED_LINE": {
        "hint": "Header lines must be module, intent, requires, ensures, result, forbid, or flow:. See examples/torqa/*.tq.",
        "doc": "examples/torqa/auth_login.tq",
    },
    "PX_TQ_MISSING_REQUIRES": {
        "hint": "Add a requires line listing inputs (e.g. username, password, ip_address for sign-in flows).",
        "doc": "examples/workspace_minimal/app.tq",
    },
    "PX_TQ_BAD_INTENT": {
        "hint": "intent must map to a PascalCase goal name (snake_case intent is converted; fix spelling or pattern).",
        "doc": "examples/workspace_minimal/app.tq",
    },
    "PX_TQ_MISSING_INTENT": {
        "hint": "Add a line: intent your_flow_name",
        "doc": "examples/workspace_minimal/app.tq",
    },
}

_TQ_DEFAULT: HintPayload = {
    "hint": "Compare with examples/workspace_minimal/app.tq or examples/torqa/*.tq.",
    "doc": "examples/workspace_minimal/README.md",
}


def tq_parse_extras(code: str) -> HintPayload:
    """Hint/doc for TQParseError.code (stable PX_TQ_*)."""
    if code in HINTS_BY_CODE:
        return HINTS_BY_CODE[code]
    return dict(_TQ_DEFAULT)


def suggested_next_for_surface_or_project_fail() -> List[str]:
    return [
        "torqa language",
        "torqa surface FILE.tq --out ir_bundle.json",
        "See examples/workspace_minimal/app.tq",
    ]


def suggested_next_from_report(rep: Dict[str, Any]) -> List[str]:
    """Short CLI-oriented next steps from a diagnostic report (ok true or false)."""
    issues: List[dict] = list(rep.get("issues") or [])
    codes = {i.get("code") for i in issues if isinstance(i.get("code"), str)}
    out: List[str] = []
    if any(c and str(c).startswith("PX_SEM_") for c in codes):
        out.append("torqa language  # list builtins, effects, and rules")
    if any(c in ("PX_IR_METADATA", "PX_IR_GOAL_EMPTY", "PX_PARSE_FAILED") for c in codes):
        out.append("torqa language --minimal-json")
    if any(c and str(c).startswith("PX_TQ_") for c in codes):
        out.append("torqa surface FILE.tq  # after fixing .tq syntax")
    if any(c in ("PX_HANDOFF", "PX_IR_SEMANTIC_DETERMINISM") for c in codes):
        out.append("torqa validate bundle.json  # after edits")
    if not out:
        out.append("torqa language --minimal-json")
    # de-dup preserve order
    seen: set[str] = set()
    deduped: List[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            deduped.append(s)
    return deduped[:6]


def augment_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
    code = issue.get("code")
    if not isinstance(code, str):
        return issue
    extra: Optional[HintPayload] = HINTS_BY_CODE.get(code)
    if not extra:
        return issue
    out = dict(issue)
    if "hint" not in out and "hint" in extra:
        out["hint"] = extra["hint"]
    if "doc" not in out and "doc" in extra:
        out["doc"] = extra["doc"]
    return out

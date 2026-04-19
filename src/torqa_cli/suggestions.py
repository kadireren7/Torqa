"""
Deterministic suggested-fix strings for CLI diagnostics (no I/O).
"""

from __future__ import annotations

from typing import Optional


def suggestion_for_parse_code(code: Optional[str]) -> str:
    if code == "PX_TQ_UNKNOWN_FLOW_STEP":
        return "Use supported flow steps"
    if code == "PX_TQ_HEADER_ORDER":
        return "Use strict tq_v1 header order"
    if code == "PX_TQ_MISSING_FLOW":
        return "Add a `flow:` block with indented steps (two spaces per step)"
    if code == "PX_TQ_MISSING_IP":
        return "Include `ip_address` in `requires` when using this flow shape"
    if code and code.startswith("PX_TQ_"):
        return "Fix the `.tq` surface per docs/quickstart.md and the PX_TQ_* code above"
    return "Fix the `.tq` parse error (docs/quickstart.md)"


def suggestion_for_load_error(message: str) -> str:
    m = message.lower()
    if "json" in m or "invalid" in m:
        return "Ensure UTF-8 JSON matches the bundle envelope or bare ir_goal shape (spec/IR_BUNDLE.schema.json)."
    if "envelope" in m or "top-level" in m:
        return "Use only allowed top-level keys on the bundle (e.g. `ir_goal`, optional `library_refs`)."
    return "Fix JSON load errors so the file is readable bundle or ir_goal JSON."


def suggestion_for_ir_payload(error: str) -> str:
    return "Repair ir_goal JSON to match the canonical IR shape (docs/concepts.md)"


def suggestion_for_structural_line(line: str) -> str:
    if "metadata" in line.lower() and "surface_meta" in line.lower():
        return "Ensure `metadata.surface_meta` keys and string values match validate_ir rules."
    if "ir_version" in line.lower():
        return "Set `metadata.ir_version` to the canonical version expected by this Torqa build."
    return "Align IR fields with validate_ir expectations (docs/concepts.md)."


def suggestion_for_semantic_line(line: str) -> str:
    ll = line.lower()
    if "unknown" in ll and "effect" in ll:
        return "Use supported effects (default registry)"
    if "unknown" in ll and "function" in ll:
        return "Use supported functions (default registry)"
    if "logic" in ll or "transition" in ll:
        return "Adjust transitions or preconditions for the default registry"
    return "Resolve semantic or logic errors (src/semantics/)"


def suggestion_for_policy_line(line: str) -> str:
    ll = line.lower()
    if "policy (strict):" in ll and "high" in ll:
        return "Lower severity or use review path"
    if "owner" in ll and "required" in ll:
        return "Add metadata owner"
    if "severity" in ll and "required" in ll:
        return "Add metadata severity"
    if "surface_meta" in ll and "dict" in ll:
        return "Ensure metadata.surface_meta is a JSON object with string values"
    return "Satisfy policy rules for the active trust profile (docs/trust-policies.md)"


def suggestion_for_policy_warning(line: str) -> str:
    if "transition count" in line.lower():
        return "Consider splitting workflows or documenting why many transitions are required."
    return "Review policy warnings; they do not fail validation alone."


def suggested_fix_when_policy_passes(policy_rep: dict) -> str:
    """Short deterministic line for `torqa check` when policy_ok (SAFE or NEEDS_REVIEW)."""
    review_required = bool(policy_rep.get("review_required"))
    risk_level = str(policy_rep.get("risk_level", "low"))
    if review_required or risk_level != "low":
        if review_required and risk_level != "low":
            return "Lower severity or complete required review before handoff"
        if review_required:
            return "Complete required human review before handoff"
        return "Confirm elevated risk is acceptable before handoff"
    return "None - policy satisfied for this profile"


def top_reason_from_policy_reasons(reasons: list) -> str:
    if not reasons:
        return "(none)"
    for r in reasons:
        if not r.startswith("Within current heuristics"):
            return r
    return reasons[0]


def suggested_next_step_blocked(stage: str, detail: str = "") -> str:
    if stage == "parse":
        return "Edit `.tq` to fix the parse error, then re-run `torqa check`."
    if stage == "load":
        return "Fix JSON and envelope, then re-run `torqa check`."
    if stage == "goal":
        return "Fix `ir_goal` payload, then re-run `torqa check`."
    if stage == "struct":
        return "Fix structural IR issues, then re-run `torqa check`."
    if stage == "semantic":
        return "Fix semantic/logic issues or registry mismatch, then re-run `torqa check`."
    if stage == "policy":
        return "Fix policy errors or change `--profile`, then re-run `torqa check`."
    return "Resolve blocking issues above, then re-run `torqa check`."

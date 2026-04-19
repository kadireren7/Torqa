"""
``torqa explain`` — plain-English, deterministic summary from existing pipeline signals.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set

from src.ir.canonical_ir import IRGoal, validate_ir
from src.policy import build_policy_report
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.surface.parse_tq import TQParseError
from src.torqa_cli.check_cmd import DECISION_REVIEW, DECISION_SAFE, _decision_from_policy_rep
from src.torqa_cli.io import goal_from_bundle, load_input
from src.torqa_cli.suggestions import (
    suggestion_for_ir_payload,
    suggestion_for_load_error,
    suggestion_for_parse_code,
    suggestion_for_policy_line,
    suggestion_for_semantic_line,
    suggestion_for_structural_line,
    suggested_fix_when_policy_passes,
    suggested_next_step_blocked,
    top_reason_from_policy_reasons,
)


def _heading(title: str) -> str:
    return f"{title}:\n"


def _describe_goal_ir(goal: IRGoal) -> str:
    n_in = len(goal.inputs)
    n_tr = len(goal.transitions)
    eff: Set[str] = {t.effect_name for t in goal.transitions}
    eff_list = ", ".join(sorted(eff)[:8])
    res = goal.result or "(unspecified)"
    parts = [
        f'The canonical workflow goal is named "{goal.goal}". ',
        f"It declares {n_in} typed input(s) and {n_tr} transition(s); the declared result label is {res!r}. ",
    ]
    if eff_list:
        parts.append(f"Transition effects in the IR include: {eff_list}. ")
    parts.append("Torqa does not run these steps; it only validates the specification.")
    return "".join(parts)


def _why_risk_paragraph(
    *,
    reached_policy: bool,
    policy_ok: bool,
    risk_level: str,
    reasons: Sequence[str],
    profile: str,
) -> str:
    if not reached_policy:
        return (
            "Risk is not assigned until the file loads, structural and semantic validation succeed, "
            "and the trust policy step runs."
        )
    if not policy_ok:
        return (
            "Risk tier is still reported by the policy pass, but policy errors block approval; "
            f"the last computed risk label was {risk_level!r} under profile {profile!r}."
        )
    rl = risk_level.lower()
    if rl == "low":
        base = (
            "Under this trust profile, deterministic heuristics classify the spec as low risk: "
            "audit metadata is usable, and nothing in the current rules pushes the tier higher."
        )
    elif rl == "medium":
        base = (
            "Risk is medium: for example, transition count or other fixed rules crossed a threshold "
            "described in the trust policy output, even though hard policy checks may still pass."
        )
    else:
        base = (
            "Risk is high: for example, the severity label is high, or other fixed signals in the "
            "report map to the high tier for prioritization and review."
        )
    detail = _pick_reason_sentence(reasons)
    if detail:
        return f"{base} {detail}"
    return base


def _pick_reason_sentence(reasons: Sequence[str]) -> str:
    for r in reasons:
        rs = str(r).strip()
        if not rs.startswith("Within current heuristics"):
            return f"One recorded signal: {rs}"
    for r in reasons:
        return f"Summary line: {r}"
    return ""


def _verdict_paragraph(
    *,
    stage: str,
    decision: Optional[str],
    policy_ok: Optional[bool],
    review_required: Optional[bool],
    blocked_detail: str,
) -> str:
    if stage == "unknown_type":
        return f"Not approved: {blocked_detail}"
    if stage in ("parse", "load"):
        return f"Not approved: the file did not load as a valid Torqa surface. {blocked_detail}"
    if stage == "goal":
        return f"Not approved: the bundle did not yield a usable ir_goal. {blocked_detail}"
    if stage == "struct":
        return f"Not approved: structural IR validation failed. {blocked_detail}"
    if stage == "sem":
        return f"Not approved: semantic or logic validation failed for the default effect registry. {blocked_detail}"
    if stage == "policy" and policy_ok is False:
        return f"Not approved: trust policy checks failed under the selected profile. {blocked_detail}"
    assert decision is not None
    if decision == DECISION_SAFE:
        return (
            "Approved for handoff under the current structural, semantic, and policy checks: "
            "you may treat the validated ir_goal as the definition-of-record for external execution "
            "(Torqa still does not run workflows here)."
        )
    if decision == DECISION_REVIEW:
        rr = review_required
        parts = [
            "Conditionally approved: the spec passes policy, but human review or elevated risk means "
            "it should not be treated as unconditionally ready.",
        ]
        if rr:
            parts.append(" Review is flagged as required before production handoff.")
        else:
            parts.append(" Review the risk reasons before relying on automation downstream.")
        return "".join(parts)
    return f"Not approved: {blocked_detail}"


def _next_paragraph(
    *,
    stage: str,
    err: Any,
    struct_line: Optional[str],
    sem_line: Optional[str],
    policy_line: Optional[str],
    policy_rep: Optional[Dict[str, Any]],
) -> str:
    if stage == "unknown_type":
        return "Use a .tq file or a JSON bundle that contains ir_goal, then re-run torqa explain."
    if stage == "parse" and isinstance(err, TQParseError):
        return f"{suggestion_for_parse_code(err.code)} Then re-run torqa explain or torqa validate."
    if stage == "load":
        return f"{suggestion_for_load_error(str(err))} Then re-run torqa explain."
    if stage == "goal":
        return f"{suggestion_for_ir_payload(str(err))} Then re-run torqa explain."
    if stage == "struct" and struct_line:
        return f"{suggestion_for_structural_line(struct_line)} {suggested_next_step_blocked('struct')}"
    if stage == "sem" and sem_line:
        return f"{suggestion_for_semantic_line(sem_line)} {suggested_next_step_blocked('semantic')}"
    if stage == "policy" and policy_line:
        return f"{suggestion_for_policy_line(policy_line)} {suggested_next_step_blocked('policy')}"
    if policy_rep is not None:
        return suggested_fix_when_policy_passes(policy_rep)
    return "No further trust-gate changes are required for this profile; integrate with your executor separately."


def cmd_explain(args: Any) -> int:
    path: Path = args.file
    profile = getattr(args, "profile", None) or "default"

    if not path.is_file():
        print(f"torqa explain: not a file: {path}", file=sys.stderr)
        return 1

    print(f"Torqa explanation for {path.resolve()}\n")

    bundle, err, input_type = load_input(path)
    if input_type == "unknown":
        print(_heading("What this spec does"))
        print(
            "The path is not a supported Torqa input type (.tq or .json bundle / ir_goal), "
            "so no workflow definition could be read."
        )
        print()
        print(_heading("Why risk is not assigned yet"))
        print(_why_risk_paragraph(reached_policy=False, policy_ok=False, risk_level="n/a", reasons=[], profile=profile))
        print()
        print(_heading("Blocked or approved for handoff"))
        print(_verdict_paragraph(stage="unknown_type", decision=None, policy_ok=None, review_required=None, blocked_detail=str(err)))
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage="unknown_type", err=err, struct_line=None, sem_line=None, policy_line=None, policy_rep=None))
        return 1

    if err is not None:
        print(_heading("What this spec does"))
        if isinstance(err, TQParseError):
            print(
                f"The file could not be parsed as strict tq_v1 text ({err.code!r}). "
                "No canonical ir_goal was produced."
            )
            stg = "parse"
            detail = f"Parse error: {err.code}."
        else:
            print(
                "The file could not be loaded as UTF-8 JSON matching a bundle or bare ir_goal shape. "
                "No canonical ir_goal was produced."
            )
            stg = "load"
            detail = f"Load error: {err}."
        print()
        print(_heading("Why risk is not assigned yet"))
        print(_why_risk_paragraph(reached_policy=False, policy_ok=False, risk_level="n/a", reasons=[], profile=profile))
        print()
        print(_heading("Blocked or approved for handoff"))
        print(_verdict_paragraph(stage=stg, decision=None, policy_ok=None, review_required=None, blocked_detail=detail))
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage=stg, err=err, struct_line=None, sem_line=None, policy_line=None, policy_rep=None))
        return 1

    if input_type == "json_batch":
        print(
            "torqa explain: JSON root array (batch) is not supported; run `torqa validate FILE.json` for batch checks "
            "or split into one bundle per file.",
            file=sys.stderr,
        )
        return 1

    assert bundle is not None
    goal, gerr = goal_from_bundle(bundle)
    if gerr is not None:
        print(_heading("What this spec does"))
        print("A bundle was loaded, but the ir_goal payload could not be normalized into the canonical IR shape.")
        print()
        print(_heading("Why risk is not assigned yet"))
        print(_why_risk_paragraph(reached_policy=False, policy_ok=False, risk_level="n/a", reasons=[], profile=profile))
        print()
        print(_heading("Blocked or approved for handoff"))
        print(
            _verdict_paragraph(
                stage="goal",
                decision=None,
                policy_ok=None,
                review_required=None,
                blocked_detail=str(gerr),
            )
        )
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage="goal", err=gerr, struct_line=None, sem_line=None, policy_line=None, policy_rep=None))
        return 1

    assert isinstance(goal, IRGoal)
    print(_heading("What this spec does"))
    print(_describe_goal_ir(goal))
    print()

    struct = validate_ir(goal)
    if struct:
        top = struct[0] if struct else "Structural validation failed"
        print(_heading("Why risk is not assigned yet"))
        print(_why_risk_paragraph(reached_policy=False, policy_ok=False, risk_level="n/a", reasons=[], profile=profile))
        print()
        print(_heading("Blocked or approved for handoff"))
        print(
            _verdict_paragraph(
                stage="struct",
                decision=None,
                policy_ok=None,
                review_required=None,
                blocked_detail=top,
            )
        )
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage="struct", err=None, struct_line=top, sem_line=None, policy_line=None, policy_rep=None))
        return 1

    reg = default_ir_function_registry()
    report = build_ir_semantic_report(goal, reg)
    sem_ok = bool(report.get("semantic_ok"))
    logic_ok = bool(report.get("logic_ok"))
    errs: List[str] = list(report.get("errors") or [])

    if not sem_ok or not logic_ok:
        top = errs[0] if errs else "Semantic or logic validation failed"
        print(_heading("Why risk is not assigned yet"))
        print(_why_risk_paragraph(reached_policy=False, policy_ok=False, risk_level="n/a", reasons=[], profile=profile))
        print()
        print(_heading("Blocked or approved for handoff"))
        print(
            _verdict_paragraph(
                stage="sem",
                decision=None,
                policy_ok=None,
                review_required=None,
                blocked_detail=top,
            )
        )
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage="sem", err=None, struct_line=None, sem_line=top, policy_line=None, policy_rep=None))
        return 1

    policy_rep = build_policy_report(goal, profile=profile)
    pok = bool(policy_rep["policy_ok"])
    risk = str(policy_rep.get("risk_level", "low"))
    reasons: List[str] = list(policy_rep.get("reasons") or [])
    rev = bool(policy_rep.get("review_required"))

    print(_heading(f"Why risk is {risk}"))
    print(_why_risk_paragraph(reached_policy=True, policy_ok=pok, risk_level=risk, reasons=reasons, profile=str(policy_rep.get("trust_profile", profile))))
    print()

    if not pok:
        perrs = list(policy_rep.get("errors") or [])
        top = perrs[0] if perrs else "Policy validation failed"
        print(_heading("Blocked or approved for handoff"))
        print(
            _verdict_paragraph(
                stage="policy",
                decision=None,
                policy_ok=False,
                review_required=rev,
                blocked_detail=top,
            )
        )
        print()
        print(_heading("What to improve next"))
        print(_next_paragraph(stage="policy", err=None, struct_line=None, sem_line=None, policy_line=top, policy_rep=None))
        return 1

    decision, _top_r, _ns = _decision_from_policy_rep(policy_rep)
    print(_heading("Blocked or approved for handoff"))
    print(
        _verdict_paragraph(
            stage="ok",
            decision=decision,
            policy_ok=True,
            review_required=rev,
            blocked_detail="",
        )
    )
    print()
    print(_heading("What to improve next"))
    print(_next_paragraph(stage="ok", err=None, struct_line=None, sem_line=None, policy_line=None, policy_rep=policy_rep))
    if getattr(args, "fail_on_warning", False):
        sem_warns = list(report.get("warnings") or [])
        pol_warns = list(policy_rep.get("warnings") or [])
        if sem_warns or pol_warns:
            print(
                "torqa explain: semantic or policy warnings present (fail-on-warning); exiting with status 1.",
                file=sys.stderr,
            )
            return 1
    return 0


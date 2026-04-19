"""
``torqa compare`` — same spec evaluated under each built-in trust profile (tabular output).
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

from src.ir.canonical_ir import IRGoal, validate_ir
from src.policy import build_policy_report
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.surface.parse_tq import TQParseError
from src.torqa_cli.check_cmd import (
    DECISION_BLOCKED,
    _decision_from_policy_rep,
)
from src.torqa_cli.io import goal_from_bundle, load_input
from src.torqa_cli.suggestions import top_reason_from_policy_reasons

BUILTIN_PROFILES: Sequence[str] = ("default", "strict", "review-heavy")


def _truncate(s: str, max_len: int = 72) -> str:
    t = s.replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def _notes_for_policy(policy_rep: Dict[str, Any]) -> str:
    if not bool(policy_rep.get("policy_ok")):
        errs: List[str] = list(policy_rep.get("errors") or [])
        return _truncate(errs[0] if errs else "Policy validation failed")
    reasons = list(policy_rep.get("reasons") or [])
    return _truncate(top_reason_from_policy_reasons(reasons))


def _row_early_block(note: str) -> Tuple[str, str, str, str, str]:
    return ("BLOCKED", "n/a", "n/a", _truncate(note))


def _print_comparison_table(rows: List[Tuple[str, str, str, str, str]]) -> None:
    """Rows: (profile, decision, risk, review, notes)."""
    headers = ("Profile", "Decision", "Risk", "Review", "Notes")
    widths = (14, 18, 8, 8, 50)
    line = (
        f"{headers[0]:<{widths[0]}} | {headers[1]:<{widths[1]}} | {headers[2]:<{widths[2]}} | "
        f"{headers[3]:<{widths[3]}} | {headers[4]}"
    )
    print(line)
    print("-" * min(120, len(line) + 10))
    for profile, decision, risk, review, notes in rows:
        r_rev = review if len(review) <= widths[3] else review[: widths[3] - 1] + "."
        print(
            f"{profile:<{widths[0]}} | {decision:<{widths[1]}} | {risk:<{widths[2]}} | "
            f"{r_rev:<{widths[3]}} | {notes}"
        )


def cmd_compare(args: Any) -> int:
    path: Path = args.file

    if not path.is_file():
        print(f"torqa compare: not a file: {path}", file=sys.stderr)
        return 1

    print(f"Torqa profile comparison for {path.resolve()}\n")

    bundle, err, input_type = load_input(path)
    if input_type == "unknown":
        note = str(err)
        rows = [(p,) + _row_early_block(note) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    if err is not None:
        if isinstance(err, TQParseError):
            note = f"{err.code}: {err}"
        else:
            note = str(err)
        rows = [(p,) + _row_early_block(note) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    assert bundle is not None
    if input_type == "json_batch":
        note = (
            f"{path.resolve().name}: JSON root is an array (batch); torqa compare evaluates one spec — "
            "use a single-bundle JSON file."
        )
        rows = [(p,) + _row_early_block(note) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    goal, gerr = goal_from_bundle(bundle)
    if gerr is not None:
        note = str(gerr)
        rows = [(p,) + _row_early_block(note) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    assert isinstance(goal, IRGoal)
    struct = validate_ir(goal)
    if struct:
        top = struct[0] if struct else "Structural validation failed"
        rows = [(p,) + _row_early_block(top) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    reg = default_ir_function_registry()
    report = build_ir_semantic_report(goal, reg)
    sem_ok = bool(report.get("semantic_ok"))
    logic_ok = bool(report.get("logic_ok"))
    errs: List[str] = list(report.get("errors") or [])

    if not sem_ok or not logic_ok:
        top = errs[0] if errs else "Semantic or logic validation failed"
        rows = [(p,) + _row_early_block(top) for p in BUILTIN_PROFILES]
        _print_comparison_table(rows)
        return 1

    out_rows: List[Tuple[str, str, str, str, str]] = []
    for pid in BUILTIN_PROFILES:
        policy_rep = build_policy_report(goal, profile=pid)
        pok = bool(policy_rep["policy_ok"])
        risk = str(policy_rep.get("risk_level", "low"))
        rev = bool(policy_rep.get("review_required"))
        rev_s = "yes" if rev else "no"
        if not pok:
            decision = DECISION_BLOCKED
            notes = _notes_for_policy(policy_rep)
        else:
            decision, _, _ = _decision_from_policy_rep(policy_rep)
            notes = _notes_for_policy(policy_rep)
        out_rows.append((pid, decision, risk, rev_s, notes))

    _print_comparison_table(out_rows)
    return 0

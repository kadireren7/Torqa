"""
``torqa scan`` — recursively evaluate ``.tq`` and ``.json`` specs under a path.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from src.surface.parse_tq import TQParseError
from src.torqa_cli.check_cmd import (
    DECISION_BLOCKED,
    DECISION_REVIEW,
    DECISION_SAFE,
    TrustEvalResult,
    evaluate_trust_from_bundle,
)
from src.torqa_cli.io import bundle_jobs, load_input


def _discover_spec_files(root: Path) -> List[Path]:
    out: List[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        suf = p.suffix.lower()
        if suf in (".tq", ".json"):
            out.append(p.resolve())
    return sorted(out)


def _display_path(scan_root: Path, file_path: Path) -> str:
    try:
        return str(file_path.resolve().relative_to(scan_root.resolve()))
    except ValueError:
        return str(file_path)


def cmd_scan(args: object) -> int:
    path: Path = args.path
    profile = getattr(args, "profile", None) or "default"
    fail_on_warning = bool(getattr(args, "fail_on_warning", False))

    if not path.exists():
        print(f"torqa scan: not found: {path}", file=sys.stderr)
        return 1

    if path.is_file():
        if path.suffix.lower() not in (".tq", ".json"):
            print(
                f"torqa scan: expected a directory or a .tq/.json file, got {path.suffix!r}",
                file=sys.stderr,
            )
            return 1
        files = [path.resolve()]
        scan_root = path.parent.resolve()
    else:
        scan_root = path.resolve()
        files = _discover_spec_files(path)

    print(f"Torqa scan of {path.resolve()}")
    print(f"Trust profile: {profile}\n")

    headers = ("File", "Decision", "Risk", "Profile result")
    w = (48, 18, 8, 16)
    print(f"{headers[0]:<{w[0]}} | {headers[1]:<{w[1]}} | {headers[2]:<{w[2]}} | {headers[3]}")
    print("-" * min(120, sum(w) + 12))

    safe = needs = blocked = 0
    warn_exit = False
    n = 0
    for fp in files:
        rel = _display_path(scan_root, fp)
        bundle, err, input_type = load_input(fp)
        if err is not None:
            n += 1
            blocked += 1
            reason = f"{err.code}: {err}" if isinstance(err, TQParseError) else str(err)
            ev = TrustEvalResult(DECISION_BLOCKED, "n/a", profile, reason)
        else:
            assert bundle is not None
            jobs = bundle_jobs(fp, bundle, input_type)
            for suffix, one_bundle in jobs:
                n += 1
                ev = evaluate_trust_from_bundle(one_bundle, profile=profile)
                if fail_on_warning and ev.has_warnings:
                    warn_exit = True
                if ev.decision == DECISION_SAFE:
                    safe += 1
                elif ev.decision == DECISION_REVIEW:
                    needs += 1
                else:
                    blocked += 1
                rel_disp = f"{rel}{suffix}" if suffix else rel
                disp = rel_disp if len(rel_disp) <= w[0] else rel_disp[: w[0] - 3] + "..."
                print(
                    f"{disp:<{w[0]}} | {ev.decision:<{w[1]}} | {ev.risk:<{w[2]}} | {ev.trust_profile}"
                )
            continue

        disp = rel if len(rel) <= w[0] else rel[: w[0] - 3] + "..."
        print(f"{disp:<{w[0]}} | {ev.decision:<{w[1]}} | {ev.risk:<{w[2]}} | {ev.trust_profile}")

    print()
    print("Summary")
    print(f"Total files: {n}")
    print(f"Safe: {safe}")
    print(f"Needs review: {needs}")
    print(f"Blocked: {blocked}")

    if blocked > 0:
        return 1
    if fail_on_warning and warn_exit:
        print(
            "torqa scan: semantic or policy warnings present (fail-on-warning); exiting with status 1.",
            file=sys.stderr,
        )
        return 1
    return 0

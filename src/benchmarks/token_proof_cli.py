"""CLI: write ``reports/token_proof.json`` and ``docs/TOKEN_PROOF.md`` (P75/P77); optional scale suite (P78)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from src.benchmarks.token_proof import build_token_proof_report, render_token_proof_markdown, report_to_canonical_json
from src.benchmarks.token_proof_scale import build_token_proof_scale_report, report_scale_to_canonical_json


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="P75 token proof report (deterministic JSON + markdown); P78 scale optional.")
    p.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Repository root (default: parent of src/)",
    )
    p.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Output JSON path (default: <repo>/reports/token_proof.json)",
    )
    p.add_argument(
        "--md-out",
        type=Path,
        default=None,
        help="Output markdown path (default: <repo>/docs/TOKEN_PROOF.md)",
    )
    p.add_argument(
        "--scale",
        action="store_true",
        help="Also write reports/token_proof_scale.json (synthetic large-intent suite).",
    )
    p.add_argument(
        "--scale-only",
        action="store_true",
        help="Only run the scale suite (skip main token_proof.json / TOKEN_PROOF.md).",
    )
    p.add_argument(
        "--scale-json-out",
        type=Path,
        default=None,
        help="Scale report path (default: <repo>/reports/token_proof_scale.json)",
    )
    synth = p.add_mutually_exclusive_group()
    synth.add_argument(
        "--synthetic-token-estimation",
        dest="synthetic_token_estimation",
        action="store_true",
        help="Scale: expand NL/baseline from repeated _shared patterns (default when --scale).",
    )
    synth.add_argument(
        "--no-synthetic-token-estimation",
        dest="synthetic_token_estimation",
        action="store_false",
        help="Scale: measure on-disk TASK.md / BASELINE_CODE.txt only (tiers will miss token floors).",
    )
    p.set_defaults(synthetic_token_estimation=True)
    args = p.parse_args(argv)

    repo = args.repo_root.resolve() if args.repo_root else Path(__file__).resolve().parents[2]
    json_out = args.json_out or (repo / "reports" / "token_proof.json")
    md_out = args.md_out or (repo / "docs" / "TOKEN_PROOF.md")
    scale_json_out = args.scale_json_out or (repo / "reports" / "token_proof_scale.json")

    run_standard = not args.scale_only
    run_scale = bool(args.scale or args.scale_only)

    exit_code = 0

    if run_standard:
        report = build_token_proof_report(repo)
        json_out.parent.mkdir(parents=True, exist_ok=True)
        md_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(report_to_canonical_json(report), encoding="utf-8")
        md_out.write_text(render_token_proof_markdown(report), encoding="utf-8")
        if report.get("summary", {}).get("failed_count"):
            print(
                f"token-proof: {report['summary']['failed_count']} scenario(s) failed — see {json_out}",
                file=sys.stderr,
            )
            exit_code = 1

    if run_scale:
        scale_report = build_token_proof_scale_report(
            repo,
            synthetic_token_estimation=args.synthetic_token_estimation,
        )
        scale_json_out.parent.mkdir(parents=True, exist_ok=True)
        scale_json_out.write_text(report_scale_to_canonical_json(scale_report), encoding="utf-8")
        mono = scale_report.get("monotonicity") or {}
        if not mono.get("prompt_tokens_non_decreasing") or not mono.get("baseline_code_tokens_non_decreasing"):
            print(
                f"token-proof-scale: monotonicity check failed — see {scale_json_out}",
                file=sys.stderr,
            )
            exit_code = 1
        if scale_report.get("summary", {}).get("failed_count"):
            print(
                f"token-proof-scale: {scale_report['summary']['failed_count']} scenario(s) failed — see {scale_json_out}",
                file=sys.stderr,
            )
            exit_code = 1

        rs = scale_report.get("ratio_stability") or {}
        if not rs.get("insufficient_passing_tiers"):
            _checks = (
                ("torqa_surface_token_stable_across_scale", "TORQA .tq token estimate drifted across tiers"),
                ("compression_ratio_monotonic_non_decreasing", "prompt/torqa compression ratio not monotonic"),
                (
                    "combined_compression_ratio_monotonic_non_decreasing",
                    "combined NL+baseline / torqa ratio not monotonic",
                ),
                ("ir_expansion_ratio_stable_across_scale", "IR/torqa expansion ratio drifted across tiers"),
            )
            for key, msg in _checks:
                if rs.get(key) is False:
                    print(f"token-proof-scale: ratio_stability — {msg} — see {scale_json_out}", file=sys.stderr)
                    exit_code = 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

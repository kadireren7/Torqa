"""CLI: ``reports/token_proof_real.json`` — real tokenizer + illustrative cost (P79)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from src.benchmarks.token_real import build_token_proof_real_report, report_real_to_canonical_json


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="P79 token proof with real tokenizer (tiktoken) + cost model.")
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
        help="Output JSON (default: <repo>/reports/token_proof_real.json)",
    )
    p.add_argument(
        "--cost-model-json",
        type=Path,
        default=None,
        help="Optional JSON file merging into default cost_model (input_cost_per_1k, output_cost_per_1k, …).",
    )
    args = p.parse_args(argv)

    repo = args.repo_root.resolve() if args.repo_root else Path(__file__).resolve().parents[2]
    out = args.json_out or (repo / "reports" / "token_proof_real.json")
    cost_overlay: dict | None = None
    if args.cost_model_json:
        cost_overlay = json.loads(args.cost_model_json.read_text(encoding="utf-8"))

    report = build_token_proof_real_report(repo, cost_model=cost_overlay)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report_real_to_canonical_json(report), encoding="utf-8")

    if report.get("summary", {}).get("failed_count"):
        print(
            f"token-proof-real: {report['summary']['failed_count']} scenario(s) failed — see {out}",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

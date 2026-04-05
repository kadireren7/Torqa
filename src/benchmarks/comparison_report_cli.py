"""CLI: write ``reports/comparison_report.json`` and mirror for website static (P136)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from src.benchmarks.comparison_report_build import build_comparison_report, report_to_canonical_json


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="P136 launch comparison report (machine + website static).")
    p.add_argument("--repo-root", type=Path, default=None, help="Repository root (default: parent of src/)")
    p.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Output JSON (default: <repo>/reports/comparison_report.json)",
    )
    p.add_argument(
        "--website-static-out",
        type=Path,
        default=None,
        help="Copy for marketing site (default: <repo>/website/static/shared/comparison_report.json)",
    )
    p.add_argument("--no-website-copy", action="store_true", help="Only write json-out")
    args = p.parse_args(argv)

    repo = args.repo_root.resolve() if args.repo_root else Path(__file__).resolve().parents[2]
    json_out = args.json_out or (repo / "reports" / "comparison_report.json")
    web_out = args.website_static_out or (repo / "website" / "static" / "shared" / "comparison_report.json")

    try:
        report = build_comparison_report(repo)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 2

    text = report_to_canonical_json(report)
    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(text, encoding="utf-8")
    if not args.no_website_copy:
        web_out.parent.mkdir(parents=True, exist_ok=True)
        web_out.write_text(text, encoding="utf-8")
    print(f"Wrote {json_out}")
    if not args.no_website_copy:
        print(f"Wrote {web_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

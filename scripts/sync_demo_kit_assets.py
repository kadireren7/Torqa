"""
P138: Refresh portable JSON snapshots under examples/demo_kit/assets/snapshots/
from canonical repo reports (token proof, comparison report, flagship compression).

Run from repo root:
  python scripts/sync_demo_kit_assets.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    out_dir = repo / "examples" / "demo_kit" / "assets" / "snapshots"
    out_dir.mkdir(parents=True, exist_ok=True)

    tp_path = repo / "reports" / "token_proof.json"
    cr_path = repo / "reports" / "comparison_report.json"
    comp_path = repo / "examples" / "benchmark_flagship" / "compression_baseline_report.json"
    expected_src = repo / "examples" / "benchmark_flagship" / "expected_output_summary.json"

    if not tp_path.is_file():
        raise SystemExit(f"Missing {tp_path} (run torqa-token-proof)")
    if not cr_path.is_file():
        raise SystemExit(f"Missing {cr_path} (run torqa-comparison-report)")
    if not comp_path.is_file():
        raise SystemExit(f"Missing {comp_path}")
    if not expected_src.is_file():
        raise SystemExit(f"Missing {expected_src}")

    tp = _read_json(tp_path)
    pub = tp.get("public_summary")
    if not isinstance(pub, dict):
        raise SystemExit("token_proof.json missing public_summary object")
    (out_dir / "token_proof_public_summary.json").write_text(
        json.dumps(pub, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    cr = _read_json(cr_path)
    flagship = cr.get("flagship_reference")
    web = None
    if isinstance(flagship, dict):
        w = flagship.get("scenario_family_websites")
        web = w if isinstance(w, dict) else None
    excerpt = {
        "generated_at": cr.get("generated_at"),
        "report_id": cr.get("report_id"),
        "schema_version": cr.get("schema_version"),
        "documentation_md": cr.get("documentation_md"),
        "honesty": cr.get("honesty"),
        "family_coverage_counts": cr.get("family_coverage_counts"),
        "token_proof_reference": cr.get("token_proof_reference"),
        "flagship_web_shell_metrics": web,
        "source_reports": cr.get("source_reports"),
        "pricing_note_en": cr.get("pricing_note_en"),
    }
    (out_dir / "comparison_launch_excerpt.json").write_text(
        json.dumps(excerpt, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    comp = _read_json(comp_path)
    metrics = comp.get("metrics")
    if not isinstance(metrics, dict):
        raise SystemExit("compression_baseline_report.json missing metrics")
    flagship_excerpt = {
        "benchmark_id": comp.get("benchmark_id"),
        "schema_version": comp.get("schema_version"),
        "metrics": metrics,
    }
    (out_dir / "flagship_compression_metrics.json").write_text(
        json.dumps(flagship_excerpt, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    shutil.copyfile(expected_src, out_dir / "expected_output_summary.json")

    meta = {
        "synced_from_repo_relative": True,
        "sources": {
            "token_proof_public_summary": "reports/token_proof.json → public_summary",
            "comparison_launch_excerpt": "reports/comparison_report.json (selected keys)",
            "flagship_compression_metrics": "examples/benchmark_flagship/compression_baseline_report.json → metrics",
            "expected_output_summary": "examples/benchmark_flagship/expected_output_summary.json (copy)",
        },
    }
    (out_dir / "SYNC_META.json").write_text(
        json.dumps(meta, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote demo kit snapshots under {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

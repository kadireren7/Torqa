"""P138: demo kit snapshot sync script produces valid JSON."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
SNAP = REPO / "examples" / "demo_kit" / "assets" / "snapshots"


@pytest.fixture(scope="module")
def sync_once() -> None:
    r = subprocess.run(
        [sys.executable, str(REPO / "scripts" / "sync_demo_kit_assets.py")],
        cwd=str(REPO),
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, r.stderr + r.stdout


@pytest.mark.usefixtures("sync_once")
def test_demo_kit_snapshots_are_valid_json() -> None:
    for name in (
        "token_proof_public_summary.json",
        "comparison_launch_excerpt.json",
        "flagship_compression_metrics.json",
        "expected_output_summary.json",
        "SYNC_META.json",
    ):
        p = SNAP / name
        assert p.is_file(), f"missing {p}"
        data = json.loads(p.read_text(encoding="utf-8"))
        assert isinstance(data, dict), name

    pub = json.loads((SNAP / "token_proof_public_summary.json").read_text(encoding="utf-8"))
    assert "headline_claim_en" in pub
    assert "suite_id" in pub

    exc = json.loads((SNAP / "comparison_launch_excerpt.json").read_text(encoding="utf-8"))
    assert exc.get("report_id") == "p136_launch_comparison_v1"
    assert isinstance(exc.get("family_coverage_counts"), dict)

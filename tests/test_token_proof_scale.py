"""P78 scale token proof: synthetic expansion, validation, monotonicity, stable JSON."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.benchmarks.token_estimate import estimate_tokens
from src.benchmarks.token_proof_scale import (
    TOKEN_PROOF_SCALE_SCHEMA_VERSION,
    TOKEN_PROOF_SCALE_SUITE_ID,
    build_token_proof_scale_report,
    expand_to_token_floor,
    report_scale_to_canonical_json,
)

REPO = Path(__file__).resolve().parents[1]
SCALE_JSON = REPO / "reports" / "token_proof_scale.json"

SCALE_TOP_KEYS = frozenset(
    {
        "estimator_id",
        "estimator_method_en",
        "manifest_relative",
        "monotonicity",
        "notes",
        "ratio_stability",
        "scale_mode",
        "scale_results",
        "schema_version",
        "scenarios",
        "summary",
        "suite_id",
        "synthetic_token_estimation",
    },
)

SCALE_RESULT_KEYS = frozenset(
    {
        "baseline_code_tokens",
        "compression_ratio",
        "compression_ratio_combined",
        "ir_to_torqa_ratio",
        "ok",
        "prompt_tokens",
        "reduction_percent",
        "size",
        "size_rank",
        "target_prompt_tokens_floor",
        "torqa_tokens",
    },
)


def test_expand_to_token_floor_deterministic_and_meets_target():
    h = "# Header\n"
    u = "line a\nline b\n"
    t = expand_to_token_floor(h, u, 500)
    t2 = expand_to_token_floor(h, u, 500)
    assert t == t2
    assert estimate_tokens(t) >= 500


def test_build_scale_report_twice_identical():
    a = build_token_proof_scale_report(REPO, synthetic_token_estimation=True)
    b = build_token_proof_scale_report(REPO, synthetic_token_estimation=True)
    assert a == b


def test_scale_report_shape_and_all_pass():
    r = build_token_proof_scale_report(REPO)
    assert set(r.keys()) == SCALE_TOP_KEYS
    assert r["schema_version"] == TOKEN_PROOF_SCALE_SCHEMA_VERSION
    assert r["suite_id"] == TOKEN_PROOF_SCALE_SUITE_ID
    assert r["scale_mode"] is True
    assert r["synthetic_token_estimation"] is True
    assert r["summary"]["failed_count"] == 0
    assert r["summary"]["passed_count"] == 5
    mono = r["monotonicity"]
    assert mono["prompt_tokens_non_decreasing"] is True
    assert mono["baseline_code_tokens_non_decreasing"] is True
    assert mono["sorted_by_size_rank"] == ["10k", "50k", "100k", "500k", "1m"]
    rs = r["ratio_stability"]
    assert rs.get("insufficient_passing_tiers") is not True
    assert rs["torqa_surface_token_stable_across_scale"] is True
    assert rs["compression_ratio_monotonic_non_decreasing"] is True
    assert rs["combined_compression_ratio_monotonic_non_decreasing"] is True
    assert rs["ir_expansion_ratio_stable_across_scale"] is True
    for row in r["scale_results"]:
        assert set(row.keys()) == SCALE_RESULT_KEYS
        assert row["ok"] is True
        assert row["prompt_tokens"] >= row["target_prompt_tokens_floor"]
        assert row["compression_ratio"] is not None and row["compression_ratio"] >= 1.0
        assert row["compression_ratio_combined"] is not None and row["compression_ratio_combined"] >= row["compression_ratio"]
        assert row["ir_to_torqa_ratio"] is not None and row["ir_to_torqa_ratio"] > 0
        assert row["reduction_percent"] is not None


def test_scale_report_canonical_json_roundtrip():
    r = build_token_proof_scale_report(REPO)
    again = json.loads(report_scale_to_canonical_json(r))
    assert again == r


@pytest.mark.skipif(not SCALE_JSON.is_file(), reason="run: torqa-token-proof --scale-only")
def test_checked_in_scale_json_matches_build():
    on_disk = json.loads(SCALE_JSON.read_text(encoding="utf-8"))
    built = build_token_proof_scale_report(REPO)
    assert on_disk == built, "reports/token_proof_scale.json stale — run: torqa-token-proof --scale-only"


def test_scale_without_synthetic_uses_small_disk_text_only():
    r = build_token_proof_scale_report(REPO, synthetic_token_estimation=False)
    assert r["synthetic_token_estimation"] is False
    for row in r["scale_results"]:
        assert row["ok"] is True
    # Headers-only prompts are far below 10k floor
    assert r["scale_results"][0]["prompt_tokens"] < 500

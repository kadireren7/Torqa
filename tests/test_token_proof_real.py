"""P79 real tokenizer report: shape, validation, determinism."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.benchmarks.token_real import (
    TOKEN_PROOF_REAL_SCHEMA_VERSION,
    TOKEN_PROOF_REAL_SUITE_ID,
    build_token_proof_real_report,
    count_tokens_real,
    report_real_to_canonical_json,
    tokenizer_method_en,
)

REPO = Path(__file__).resolve().parents[1]
REAL_JSON = REPO / "reports" / "token_proof_real.json"

TOP_KEYS = frozenset(
    {
        "cost_model",
        "estimator_vs_real_diff",
        "manifest_relative",
        "no_external_api",
        "notes",
        "offline",
        "reference_estimator_id",
        "reference_estimator_method_en",
        "scenarios",
        "schema_version",
        "summary",
        "suite_id",
        "tokenizer_backend_id",
        "tokenizer_encoding",
        "tokenizer_method_en",
    },
)


def test_count_tokens_real_non_empty():
    n = count_tokens_real("hello world")
    assert isinstance(n, int) and n >= 1


def test_tokenizer_method_en_nonempty():
    assert len(tokenizer_method_en()) > 20


def test_build_token_proof_real_report_shape_and_all_pass():
    r = build_token_proof_real_report(REPO)
    r2 = build_token_proof_real_report(REPO)
    assert r == r2
    assert set(r.keys()) == TOP_KEYS
    assert r["schema_version"] == TOKEN_PROOF_REAL_SCHEMA_VERSION
    assert r["suite_id"] == TOKEN_PROOF_REAL_SUITE_ID
    assert r["offline"] is True
    assert r["no_external_api"] is True
    assert r["summary"]["failed_count"] == 0
    assert r["summary"]["passed_count"] == 5

    diff = r["estimator_vs_real_diff"]
    assert "prompt_mean_delta_tokens" in diff
    assert "torqa_mean_delta_tokens" in diff
    assert "prompt_mean_ratio_real_over_est" in diff

    for row in r["scenarios"]:
        assert row["ok"] is True
        assert isinstance(row["prompt_tokens_real"], int)
        assert isinstance(row["torqa_tokens_real"], int)
        assert isinstance(row["baseline_code_tokens_real"], int)
        assert row["output_tokens_real"] == 0
        assert row["total_tokens_real"] == (
            row["prompt_tokens_real"] + row["torqa_tokens_real"] + row["baseline_code_tokens_real"]
        )
        assert row["cost_reduction_percent"] is not None
        assert isinstance(row["prompt_cost"], float)
        assert isinstance(row["torqa_cost"], float)


def test_canonical_json_roundtrip():
    r = build_token_proof_real_report(REPO)
    again = json.loads(report_real_to_canonical_json(r))
    assert again == r


@pytest.mark.skipif(not REAL_JSON.is_file(), reason="run: torqa-token-proof-real")
def test_checked_in_real_json_matches_build():
    on_disk = json.loads(REAL_JSON.read_text(encoding="utf-8"))
    built = build_token_proof_real_report(REPO)
    assert on_disk == built, "reports/token_proof_real.json stale — run: torqa-token-proof-real"

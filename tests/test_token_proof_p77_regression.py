"""P77: regression guard for token proof JSON shape, scenario ids, and checked-in report sync."""

from __future__ import annotations

import json
from pathlib import Path

from src.benchmarks.token_proof import (
    TOKEN_PROOF_PUBLIC_SUITE_ID,
    TOKEN_PROOF_SCHEMA_VERSION,
    build_token_proof_report,
    report_to_canonical_json,
)

REPO = Path(__file__).resolve().parents[1]
REPORT_PATH = REPO / "reports" / "token_proof.json"

# Intentionally change this constant when adding/removing scenarios or accepting new baselines.
EXPECTED_SCENARIO_COUNT = 5
EXPECTED_PASSED_COUNT = 5

# Stable manifest order — update when manifest order or ids change.
EXPECTED_SCENARIO_IDS = (
    "simple_form_flow",
    "approval_workflow",
    "data_transform_pipeline",
    "conditional_logic_flow",
    "multi_step_automation",
)

TOKEN_PROOF_TOP_LEVEL_KEYS = frozenset(
    {
        "estimator_id",
        "estimator_method_en",
        "manifest_relative",
        "notes",
        "public_summary",
        "scenarios",
        "schema_version",
        "summary",
    },
)

PUBLIC_SUMMARY_KEYS = frozenset(
    {
        "average_compression_ratio_prompt_per_torqa",
        "average_prompt_token_reduction_percent_vs_torqa",
        "documentation_md",
        "failed_scenario_count",
        "failed_scenario_ids",
        "headline_claim_en",
        "machine_report_json",
        "measurement_focus_en",
        "not_the_headline_en",
        "passed_scenario_count",
        "scenario_count",
        "suite_id",
    },
)

SUMMARY_KEYS = frozenset(
    {
        "average_compression_ratio_combined_nl_code_per_torqa",
        "average_compression_ratio_prompt_per_torqa",
        "average_prompt_token_reduction_percent_vs_torqa",
        "failed_count",
        "passed_count",
        "scenario_count",
    },
)


def test_token_proof_checked_in_json_matches_live_build():
    assert REPORT_PATH.is_file(), "missing reports/token_proof.json — run: torqa-token-proof"
    on_disk = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    built = build_token_proof_report(REPO)
    assert on_disk == built, "reports/token_proof.json is stale — run: torqa-token-proof"


def test_token_proof_top_level_and_public_summary_shape():
    r = build_token_proof_report(REPO)
    assert set(r.keys()) == TOKEN_PROOF_TOP_LEVEL_KEYS
    assert r["schema_version"] == TOKEN_PROOF_SCHEMA_VERSION
    pub = r["public_summary"]
    assert set(pub.keys()) == PUBLIC_SUMMARY_KEYS
    assert pub["suite_id"] == TOKEN_PROOF_PUBLIC_SUITE_ID
    assert set(r["summary"].keys()) == SUMMARY_KEYS


def test_token_proof_scenario_ids_and_passing_count_stable():
    r = build_token_proof_report(REPO)
    ids = tuple(str(row["id"]) for row in r["scenarios"])
    assert ids == EXPECTED_SCENARIO_IDS
    assert r["summary"]["scenario_count"] == EXPECTED_SCENARIO_COUNT
    assert r["summary"]["passed_count"] == EXPECTED_PASSED_COUNT
    assert r["public_summary"]["scenario_count"] == EXPECTED_SCENARIO_COUNT
    assert r["public_summary"]["passed_scenario_count"] == EXPECTED_PASSED_COUNT


def test_token_proof_ok_rows_have_stable_metric_keys():
    r = build_token_proof_report(REPO)
    for row in r["scenarios"]:
        assert "id" in row and "category" in row and "relative_dir" in row
        assert "ok" in row and "errors" in row and "sources" in row and "token_counts" in row
        tc = row["token_counts"]
        for k in (
            "prompt_tokens",
            "baseline_code_tokens",
            "torqa_tokens",
            "combined_nl_and_code_tokens",
            "ir_tokens",
        ):
            assert k in tc
        if row["ok"]:
            assert "compression_ratio_prompt_per_torqa" in row
            assert "compression_ratio_combined_per_torqa" in row
            assert "ir_to_torqa_ratio" in row


def test_token_proof_canonical_json_roundtrip_equals_build():
    r = build_token_proof_report(REPO)
    again = json.loads(report_to_canonical_json(r))
    assert again == r

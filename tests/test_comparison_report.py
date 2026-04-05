"""P136: comparison_report.json is present, matches schema, and matches token_proof scenario ids."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture
def comparison_report() -> dict:
    p = REPO / "reports" / "comparison_report.json"
    assert p.is_file(), "run: torqa-comparison-report"
    return json.loads(p.read_text(encoding="utf-8"))


@pytest.fixture
def schema() -> dict:
    p = REPO / "spec" / "comparison_report.schema.json"
    return json.loads(p.read_text(encoding="utf-8"))


def test_comparison_report_required_keys(comparison_report: dict, schema: dict):
    req = schema.get("required", [])
    for k in req:
        assert k in comparison_report, f"missing {k}"


def test_comparison_report_token_proof_scenarios_match(comparison_report: dict):
    tp_path = REPO / "reports" / "token_proof.json"
    tp = json.loads(tp_path.read_text(encoding="utf-8"))
    tp_ids = {s["id"] for s in tp.get("scenarios", []) if isinstance(s, dict) and "id" in s}
    cr = comparison_report.get("token_proof_reference") or {}
    rows = cr.get("scenarios") or []
    cr_ids = {r["id"] for r in rows if isinstance(r, dict) and "id" in r}
    assert cr_ids == tp_ids, (cr_ids, tp_ids)


def test_website_static_copy_matches_canonical():
    a = REPO / "reports" / "comparison_report.json"
    b = REPO / "website" / "static" / "shared" / "comparison_report.json"
    assert a.read_text(encoding="utf-8") == b.read_text(encoding="utf-8")

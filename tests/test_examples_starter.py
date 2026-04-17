"""Committed starter examples under examples/ must stay valid (parse + CLI)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.torqa_cli.main import main

REPO = Path(__file__).resolve().parents[1]
EXAMPLES = REPO / "examples"


@pytest.mark.parametrize(
    "name",
    [
        "approval_flow.tq",
        "ai_generated.json",
    ],
)
def test_starter_example_validates_via_cli(name: str):
    path = EXAMPLES / name
    assert path.is_file(), f"missing {path}"
    code = main(["validate", str(path)])
    assert code == 0, f"torqa validate failed for {path}"


def test_ai_generated_is_bundle_with_ir_goal():
    p = EXAMPLES / "ai_generated.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    assert "ir_goal" in data
    assert data["ir_goal"].get("goal") == "AiSuggestedFlow"

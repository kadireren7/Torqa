"""
Engine parity (Rust vs Python) on golden IR — run in CI alongside Rust tests.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.execution.parity_report import build_engine_parity_report
from src.ir.canonical_ir import ir_goal_from_json

REPO = Path(__file__).resolve().parents[1]


def test_minimal_flow_engine_parity_when_rust_bridge_ok():
    raw = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    g = ir_goal_from_json(raw)
    r = build_engine_parity_report(g, {"username": "alice"})
    rust = r.get("rust_summary") or {}
    if not rust.get("bridge_ok"):
        pytest.skip("Rust bridge not available or failed in this environment")
    assert r.get("parity_ok") is True, r

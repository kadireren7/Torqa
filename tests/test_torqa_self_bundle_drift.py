"""Drift guard: every self-host .tq must match its committed bundle (registry-driven)."""

from __future__ import annotations

import json
from pathlib import Path

from src.surface.parse_tq import parse_tq_source
from src.torqa_self.bundle_registry import self_host_bundle_pairs


def test_self_host_tq_matches_committed_bundle_ir_goal():
    for tq_path, bundle_path in self_host_bundle_pairs():
        assert tq_path.is_file(), f"missing {tq_path}"
        assert bundle_path.is_file(), f"missing {bundle_path}"
        raw = tq_path.read_text(encoding="utf-8")
        live = parse_tq_source(raw, tq_path=tq_path.resolve())
        committed = json.loads(bundle_path.read_text(encoding="utf-8"))
        assert live.get("ir_goal") == committed.get("ir_goal"), (
            f"drift {tq_path.name}: regenerate with torqa surface (see examples/torqa_self/README.md)"
        )

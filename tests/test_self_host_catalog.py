"""P17: self-host catalog stays aligned with registry (no duplicate policy sources)."""

from __future__ import annotations

from pathlib import Path

from src.torqa_self.bundle_registry import (
    SINGLE_FLOW_LINE,
    self_host_bundle_pairs,
    self_host_catalog,
    self_host_group_blurbs,
)


def test_catalog_len_matches_registry():
    assert len(self_host_catalog()) == len(self_host_bundle_pairs())


def test_catalog_paths_exist():
    repo = Path(__file__).resolve().parents[1]
    for row in self_host_catalog():
        assert (repo / row["tq"]).is_file(), row["tq"]
        assert (repo / row["bundle"]).is_file(), row["bundle"]


def test_group_blurbs_cover_catalog_groups():
    blurbs = self_host_group_blurbs()
    for row in self_host_catalog():
        assert row["group"] in blurbs


def test_single_flow_line_is_documented():
    assert "torqa build" in SINGLE_FLOW_LINE.lower()

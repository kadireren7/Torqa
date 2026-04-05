"""P117: edition manifest (.torqa/edition_manifest.json) helpers."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.ai.tq_edition_manifest import load_manifest, peek_next_edition, register_edition


@pytest.fixture()
def empty_workspace(tmp_path: Path) -> Path:
    (tmp_path / "src").mkdir()
    return tmp_path


def test_peek_greenfield_vs_evolve(empty_workspace: Path) -> None:
    assert peek_next_edition(empty_workspace, for_evolve=False) == 1
    assert peek_next_edition(empty_workspace, for_evolve=True) == 2


def test_register_initial_then_peek(empty_workspace: Path) -> None:
    e1 = register_edition(empty_workspace, relative_path="a.tq", kind="initial", parent_relative=None)
    assert e1 == 1
    assert peek_next_edition(empty_workspace, for_evolve=False) == 2
    assert peek_next_edition(empty_workspace, for_evolve=True) == 2


def test_evolve_bootstraps_baseline_parent(empty_workspace: Path) -> None:
    (empty_workspace / "v1.tq").write_text("screen x\n", encoding="utf-8")
    e2 = register_edition(
        empty_workspace,
        relative_path="app_edition_002_x.tq",
        kind="improve",
        parent_relative="v1.tq",
    )
    assert e2 == 2
    m = load_manifest(empty_workspace)
    paths = [str(x.get("relative_path")) for x in m["entries"]]
    assert paths == ["v1.tq", "app_edition_002_x.tq"]
    kinds = [str(x.get("kind")) for x in m["entries"]]
    assert kinds == ["baseline", "improve"]
    assert m["entries"][0].get("edition") == 1
    assert m["entries"][1].get("parent") == "v1.tq"


def test_manifest_is_valid_json(empty_workspace: Path) -> None:
    register_edition(empty_workspace, relative_path="z.tq", kind="initial", parent_relative=None)
    p = empty_workspace / ".torqa" / "edition_manifest.json"
    assert p.is_file()
    data = json.loads(p.read_text(encoding="utf-8"))
    assert "entries" in data and isinstance(data["entries"], list)

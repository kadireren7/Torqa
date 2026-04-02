"""
Golden IR for canonical ``.tq`` sources: any intentional mapping change must update
``tests/data/tq_golden/*.ir.json`` (or the paired ``examples/torqa/canonical_*.tq``).
"""

from __future__ import annotations

import json
from difflib import unified_diff
from pathlib import Path

import pytest

from src.surface.parse_tq import parse_tq_source

REPO = Path(__file__).resolve().parents[1]
TQ_EXAMPLES = REPO / "examples" / "torqa"
GOLDEN_DIR = REPO / "tests" / "data" / "tq_golden"

_GOLDEN_CASES: list[tuple[str, str]] = [
    ("canonical_minimal.tq", "canonical_minimal.ir.json"),
    ("canonical_session_flow.tq", "canonical_session_flow.ir.json"),
    ("canonical_view_login.tq", "canonical_view_login.ir.json"),
]


def _canonical_json(obj: object) -> str:
    """Stable string for dict equality (key order independent of JSON file layout)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


@pytest.mark.parametrize("tq_name,golden_name", _GOLDEN_CASES)
def test_canonical_tq_matches_golden_ir(tq_name: str, golden_name: str) -> None:
    tq_path = TQ_EXAMPLES / tq_name
    golden_path = GOLDEN_DIR / golden_name
    assert tq_path.is_file(), f"missing source {tq_path}"
    assert golden_path.is_file(), f"missing golden {golden_path}"

    raw = tq_path.read_text(encoding="utf-8")
    expected = json.loads(golden_path.read_text(encoding="utf-8"))
    actual = parse_tq_source(raw, tq_path=tq_path)

    exp_s = _canonical_json(expected)
    act_s = _canonical_json(actual)
    if exp_s != act_s:
        diff = unified_diff(
            exp_s.splitlines(),
            act_s.splitlines(),
            fromfile=f"golden:{golden_name}",
            tofile=f"parsed:{tq_name}",
            lineterm="",
        )
        msg = "\n".join(diff)
        pytest.fail(f"IR mismatch for {tq_name} vs {golden_name}\n{msg}")


def test_golden_dir_has_no_extra_files() -> None:
    """Keep golden set aligned with parametrized cases (no orphan expectations)."""
    allowed = {g for _, g in _GOLDEN_CASES}
    on_disk = {p.name for p in GOLDEN_DIR.glob("*.ir.json")}
    assert on_disk == allowed, f"golden dir must match CASES: {on_disk ^ allowed}"

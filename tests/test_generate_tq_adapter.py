"""P76: deterministic validation helper for .tq generation path."""

from __future__ import annotations

from pathlib import Path

from src.ai.tq_adapter import validate_tq_text


REPO = Path(__file__).resolve().parents[1]


def test_validate_tq_text_accepts_minimal_template(tmp_path: Path):
    text = (REPO / "examples" / "torqa" / "templates" / "minimal.tq").read_text(encoding="utf-8")
    ok, diag, err = validate_tq_text(text, synthetic_path=tmp_path / "minimal.tq")
    assert ok, err
    assert diag is not None
    assert diag.get("ok") is True


def test_validate_tq_text_rejects_garbage(tmp_path: Path):
    ok, _diag, err = validate_tq_text("not a tq file\n", synthetic_path=tmp_path / "bad.tq")
    assert not ok
    assert err

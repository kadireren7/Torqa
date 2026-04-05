"""P116: multi-phase .tq generation config."""

from __future__ import annotations

import os

import pytest

from src.ai.tq_gen_phases import phase_rows, resolve_tq_gen_phases


def test_resolve_default_is_three(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TORQA_TQ_GEN_PHASES", raising=False)
    assert resolve_tq_gen_phases(None) == 3


def test_resolve_cli_clamped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TORQA_TQ_GEN_PHASES", raising=False)
    assert resolve_tq_gen_phases(1) == 1
    assert resolve_tq_gen_phases(99) == 3


def test_resolve_env_overrides_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TORQA_TQ_GEN_PHASES", "2")
    assert resolve_tq_gen_phases(None) == 2


def test_phase_rows_lengths() -> None:
    assert len(phase_rows(1)) == 1
    assert len(phase_rows(2)) == 2
    assert len(phase_rows(3)) == 3

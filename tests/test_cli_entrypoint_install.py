"""P121: ``torqa`` console script and ``python -m torqa`` resolve to the same entrypoint after install."""

from __future__ import annotations

import shutil
import subprocess
import sys
from importlib.metadata import entry_points
from pathlib import Path

import pytest
import tomllib


def test_pyproject_declares_torqa_console_script() -> None:
    root = Path(__file__).resolve().parents[1]
    data = tomllib.loads(root.joinpath("pyproject.toml").read_text(encoding="utf-8"))
    scripts = data.get("project", {}).get("scripts", {})
    assert scripts.get("torqa") == "src.cli.main:main"


def test_console_scripts_entry_point_registered_and_loadable() -> None:
    matches = list(entry_points().select(group="console_scripts", name="torqa"))
    if not matches:
        pytest.skip("Console script not registered (run `pip install -e .` from repo root — see docs/QUICKSTART.md)")
    assert len(matches) == 1
    fn = matches[0].load()
    assert callable(fn)
    assert getattr(fn, "__name__", "") == "main"


def test_python_m_torqa_version_succeeds() -> None:
    r = subprocess.run(
        [sys.executable, "-m", "torqa", "--version"],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=Path(__file__).resolve().parents[1],
    )
    assert r.returncode == 0, (r.stdout, r.stderr)
    out = (r.stdout or "").strip()
    assert out.startswith("torqa "), out


@pytest.mark.skipif(shutil.which("torqa") is None, reason="torqa executable not on PATH (use same venv as pytest)")
def test_torqa_on_path_matches_module_invocation() -> None:
    exe = shutil.which("torqa")
    assert exe
    r = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, (r.stdout, r.stderr)
    r2 = subprocess.run(
        [sys.executable, "-m", "torqa", "--version"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert r2.returncode == 0
    assert (r.stdout or "").strip() == (r2.stdout or "").strip()

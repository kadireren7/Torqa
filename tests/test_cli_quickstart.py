"""Tests for ``torqa quickstart``."""

from __future__ import annotations

import json
from pathlib import Path

from torqa.cli.main import main


def test_quickstart_runs_and_prints_summary(capsys):
    code = main(["quickstart"])
    assert code == 0
    out = capsys.readouterr().out
    assert "Torqa quickstart" in out
    assert "Decision:" in out
    assert "Risk level:" in out
    assert "Next steps:" in out
    assert "torqa validate" in out


def test_quickstart_generates_markdown_report(tmp_path: Path, capsys):
    out_md = tmp_path / "quickstart.md"
    code = main(["quickstart", "--report", "--report-format", "md", "--report-output", str(out_md)])
    assert code == 0
    text = out_md.read_text(encoding="utf-8")
    assert "# Torqa trust report" in text
    assert "## Summary" in text
    assert "Report:" in capsys.readouterr().out


def test_quickstart_generates_json_report(tmp_path: Path):
    out_json = tmp_path / "quickstart.json"
    code = main(["quickstart", "--report", "--report-format", "json", "--report-output", str(out_json)])
    assert code == 0
    payload = json.loads(out_json.read_text(encoding="utf-8"))
    assert payload["schema"] == "torqa.report.v1"
    assert "summary" in payload

"""Shared read helpers for committed self-host IR bundles (examples/torqa_self/)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_bundle_ir_goal(bundle_path: Path) -> Optional[Dict[str, Any]]:
    """Return ``ir_goal`` dict or ``None`` if file missing or shape invalid."""
    if not bundle_path.is_file():
        return None
    try:
        data = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    ig = data.get("ir_goal")
    return ig if isinstance(ig, dict) else None


def ir_goal_input_names(ir_goal: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    inputs = ir_goal.get("inputs")
    if not isinstance(inputs, list):
        return out
    for row in inputs:
        if isinstance(row, dict):
            name = row.get("name")
            if isinstance(name, str):
                out.append(name)
    return out

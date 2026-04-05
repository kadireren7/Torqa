"""
P117: Track logical editions (v1, v2, …) of generated .tq files in a workspace.

Manifest: ``<workspace>/.torqa/edition_manifest.json``
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


def _manifest_path(workspace: Path) -> Path:
    d = workspace.resolve() / ".torqa"
    d.mkdir(parents=True, exist_ok=True)
    return d / "edition_manifest.json"


def load_manifest(workspace: Path) -> Dict[str, Any]:
    p = _manifest_path(workspace)
    if not p.is_file():
        return {"entries": []}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"entries": []}
    ent = data.get("entries")
    if not isinstance(ent, list):
        return {"entries": []}
    return {"entries": ent}


def save_manifest(workspace: Path, data: Dict[str, Any]) -> None:
    p = _manifest_path(workspace)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _max_edition(entries: List[Dict[str, Any]]) -> int:
    m = 0
    for e in entries:
        if isinstance(e, dict) and isinstance(e.get("edition"), int):
            m = max(m, int(e["edition"]))
    return m


def peek_next_edition(workspace: Path, *, for_evolve: bool = False) -> int:
    """
    Next edition number for an **about-to-be-written** file.

    Initial greenfield generation uses v1. The first evolve in a workspace without manifest uses v2
    (implicit v1 = the source .tq).
    """
    m = load_manifest(workspace)
    ent = m.get("entries") or []
    if not ent:
        return 2 if for_evolve else 1
    return _max_edition(ent) + 1


def _has_path(entries: List[Dict[str, Any]], rel: str) -> bool:
    for e in entries:
        if isinstance(e, dict) and str(e.get("relative_path") or "") == rel:
            return True
    return False


def register_edition(
    workspace: Path,
    *,
    relative_path: str,
    kind: str,
    parent_relative: Optional[str],
) -> int:
    """
    Append manifest entry; returns assigned edition.

    If ``parent_relative`` is set but not yet listed, inserts a synthetic v1 baseline row first.
    """
    m = load_manifest(workspace)
    entries: List[Dict[str, Any]] = list(m.get("entries") or [])
    rel = relative_path.replace("\\", "/")
    parent = parent_relative.replace("\\", "/") if parent_relative else None

    if parent and not _has_path(entries, parent):
        entries.append(
            {
                "edition": 1,
                "relative_path": parent,
                "kind": "baseline",
                "parent": None,
            }
        )

    edition = _max_edition(entries) + 1

    entries.append(
        {
            "edition": edition,
            "relative_path": rel,
            "kind": kind,
            "parent": parent,
        }
    )
    save_manifest(workspace, {"entries": entries})
    return edition


def list_editions(workspace: Path) -> List[Dict[str, Any]]:
    return list(load_manifest(workspace).get("entries") or [])

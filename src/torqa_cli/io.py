"""
Shared file loading for Torqa CLI (parse .tq, load bundle JSON).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from src.ir.canonical_ir import ir_goal_from_json
from src.surface.parse_tq import TQParseError, parse_tq_source
from src.torqa_cli.bundle_load import load_bundle_from_json_path

LoadErr = Union[str, TQParseError, None]

# One bundle dict, or several from a JSON array file.
BundlePayload = Union[Dict[str, Any], List[Dict[str, Any]]]


def load_input(path: Path) -> Tuple[Optional[BundlePayload], LoadErr, str]:
    """
    Returns ``(payload, error, input_type)`` where ``input_type`` is
    ``tq``, ``json``, ``json_batch``, or ``unknown``.

    For ``.json`` files, the root may be a single bundle object or an **array of bundle objects**
    (``json_batch``).
    """
    suf = path.suffix.lower()
    if suf == ".tq":
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as ex:
            return None, f"{path}: {ex}", "tq"
        try:
            bundle = parse_tq_source(text, tq_path=path.resolve())
            return bundle, None, "tq"
        except TQParseError as e:
            return None, e, "tq"
    if suf == ".json":
        payload, err = load_bundle_from_json_path(path)
        if err is not None:
            return None, err, "json"
        assert payload is not None
        if isinstance(payload, list):
            return payload, None, "json_batch"
        return payload, None, "json"
    return None, f"unsupported file type {path.suffix!r} (use .tq or .json)", "unknown"


def bundle_jobs(
    file_path: Path,
    payload: Optional[BundlePayload],
    input_type: str,
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Expand a loaded payload into ``(label_suffix, bundle)`` jobs.

    ``label_suffix`` is ``\"\"`` for a single bundle, or ``\"[i]\"`` for the *i*-th element of a
    JSON array file (display as ``file.json[0]``, etc.).
    """
    if payload is None:
        return []
    if input_type == "json_batch":
        assert isinstance(payload, list)
        return [(f"[{i}]", b) for i, b in enumerate(payload)]
    assert isinstance(payload, dict)
    return [("", payload)]


def goal_from_bundle(bundle: Dict[str, Any], *, path_hint: str = "") -> Tuple[Any, Optional[str]]:
    try:
        return ir_goal_from_json(bundle), None
    except (TypeError, KeyError, ValueError) as ex:
        prefix = f"{path_hint}: " if path_hint else ""
        return None, f"{prefix}Invalid ir_goal payload: {ex}"

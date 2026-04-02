"""Load ``compose.json`` for ``torqa compose``."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .errors import PX_PKG_COMPOSE_SPEC, PackageError


def load_compose_spec(spec_path: Path) -> Dict[str, Any]:
    if not spec_path.is_file():
        raise PackageError(PX_PKG_COMPOSE_SPEC, f"Compose spec not found: {spec_path}")
    try:
        data = json.loads(spec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise PackageError(PX_PKG_COMPOSE_SPEC, f"Invalid compose JSON: {ex}") from ex
    if not isinstance(data, dict):
        raise PackageError(PX_PKG_COMPOSE_SPEC, "Compose spec must be a JSON object.")
    if not isinstance(data.get("primary"), str) or not data["primary"].strip():
        raise PackageError(PX_PKG_COMPOSE_SPEC, "Compose spec requires non-empty 'primary' path.")
    fr = data.get("fragments")
    if fr is not None and not isinstance(fr, list):
        raise PackageError(PX_PKG_COMPOSE_SPEC, "'fragments' must be an array if present.")
    return data


def load_bundle_json(path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise PackageError(PX_PKG_COMPOSE_SPEC, f"Invalid bundle JSON {path}: {ex}") from ex
    if not isinstance(data, dict):
        raise PackageError(PX_PKG_COMPOSE_SPEC, f"Expected object in {path}")
    return data


def load_fragment_json(path: Path) -> Dict[str, Any]:
    return load_bundle_json(path)

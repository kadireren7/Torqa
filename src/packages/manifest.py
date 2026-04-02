"""Load and validate ``torqa.package.json``."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from src.ir.canonical_ir import CANONICAL_IR_VERSION

from .errors import PX_PKG_MANIFEST_INVALID, PackageError


def load_package_manifest(package_root: Path) -> Dict[str, Any]:
    """Read ``torqa.package.json`` under ``package_root`` and validate minimal fields."""
    path = package_root / "torqa.package.json"
    if not path.is_file():
        raise PackageError(PX_PKG_NOT_FOUND, f"torqa.package.json not found under {package_root}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise PackageError(PX_PKG_MANIFEST_INVALID, f"Invalid JSON in {path}: {ex}") from ex
    if not isinstance(data, dict):
        raise PackageError(PX_PKG_MANIFEST_INVALID, "Package manifest must be a JSON object.")
    _validate_manifest(data, path)
    return data


def _validate_manifest(data: Dict[str, Any], path: Path) -> None:
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: 'name' must be a non-empty string.")
    ver = data.get("version")
    if not isinstance(ver, str) or not ver.strip():
        raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: 'version' must be a non-empty string.")
    ir_v = data.get("ir_version")
    if ir_v != CANONICAL_IR_VERSION:
        raise PackageError(
            PX_PKG_MANIFEST_INVALID,
            f"{path}: ir_version must be {CANONICAL_IR_VERSION!r}, got {ir_v!r}.",
        )
    exports = data.get("exports")
    if not isinstance(exports, dict) or not exports:
        raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: 'exports' must be a non-empty object.")
    for k, v in exports.items():
        if not isinstance(k, str) or not isinstance(v, str) or not v.strip():
            raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: exports keys/values must be non-empty strings.")
    deps = data.get("dependencies")
    if deps is not None:
        if not isinstance(deps, list):
            raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: 'dependencies' must be an array if present.")
        for i, d in enumerate(deps):
            if not isinstance(d, dict):
                raise PackageError(PX_PKG_MANIFEST_INVALID, f"{path}: dependencies[{i}] must be an object.")
            if not isinstance(d.get("name"), str) or not isinstance(d.get("version"), str):
                raise PackageError(
                    PX_PKG_MANIFEST_INVALID,
                    f"{path}: dependencies[{i}] needs string 'name' and 'version'.",
                )


def list_export_files(package_root: Path, manifest: Dict[str, Any]) -> List[Tuple[str, Path]]:
    """Sorted (export_key, absolute_path) for fingerprinting."""
    out: List[Tuple[str, Path]] = []
    exports = manifest.get("exports") or {}
    for key in sorted(exports.keys()):
        rel = exports[key]
        fp = (package_root / rel).resolve()
        if not fp.is_file():
            raise PackageError(PX_PKG_NOT_FOUND, f"Package export {key!r} -> {rel!r} is not a file under {package_root}")
        out.append((key, fp))
    return out

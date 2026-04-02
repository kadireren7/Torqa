"""Minimal file-based registry: ``torqa-registry.json`` + ``.tgz`` artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.error import URLError, HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen

from .errors import PX_PKG_NOT_FOUND, PX_PKG_REGISTRY_INVALID, PackageError

REGISTRY_FILENAME = "torqa-registry.json"


def _read_json_file(path: Path) -> Dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise PackageError(PX_PKG_REGISTRY_INVALID, f"Invalid registry JSON {path}: {ex}") from ex
    if not isinstance(data, dict):
        raise PackageError(PX_PKG_REGISTRY_INVALID, f"Registry must be a JSON object: {path}")
    return data


def load_registry_bundle(spec: str) -> Tuple[Dict[str, Any], str]:
    """
    Load registry index. ``spec`` is either:

    - A directory containing ``torqa-registry.json`` (returns file dict, base URL or path for artifacts).
    - A path to ``torqa-registry.json``.
    - ``http(s)://.../torqa-registry.json`` (fetches JSON; base is directory URL of that file).

    Returns ``(data, artifact_base)`` where ``artifact_base`` ends with ``/`` for URL or is a local dir path.
    """
    s = spec.strip()
    if s.startswith("http://") or s.startswith("https://"):
        try:
            with urlopen(s, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
        except (URLError, HTTPError, OSError) as ex:
            raise PackageError(PX_PKG_NOT_FOUND, f"Could not fetch registry URL {s!r}: {ex}") from ex
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as ex:
            raise PackageError(PX_PKG_REGISTRY_INVALID, f"Invalid registry JSON from URL: {ex}") from ex
        if not isinstance(data, dict):
            raise PackageError(PX_PKG_REGISTRY_INVALID, "Registry URL must return a JSON object.")
        parsed = urlparse(s)
        base = urljoin(s, ".")  # dirname with trailing slash semantics for urljoin
        if not base.endswith("/"):
            base = base.rsplit("/", 1)[0] + "/"
        return data, base
    p = Path(s)
    if p.is_dir():
        reg = p / REGISTRY_FILENAME
        if not reg.is_file():
            raise PackageError(PX_PKG_NOT_FOUND, f"Registry file not found: {reg}")
        data = _read_json_file(reg)
        base = str(p.resolve()) + "/"
        return data, base
    if p.is_file():
        data = _read_json_file(p)
        base = str(p.parent.resolve()) + "/"
        return data, base
    raise PackageError(PX_PKG_NOT_FOUND, f"Registry path not found: {s}")


def find_registry_entry(data: Dict[str, Any], name: str, version: str) -> Dict[str, Any]:
    pkgs = data.get("packages")
    if not isinstance(pkgs, list):
        raise PackageError(PX_PKG_REGISTRY_INVALID, "Registry missing 'packages' array.")
    for row in pkgs:
        if not isinstance(row, dict):
            continue
        if row.get("name") == name and row.get("version") == version:
            return row
    raise PackageError(PX_PKG_NOT_FOUND, f"No package {name!r}@{version!r} in registry.")


def resolve_artifact_uri(artifact_base: str, artifact: str) -> str:
    """Join registry base with artifact filename (or pass through absolute URL)."""
    a = (artifact or "").strip()
    if not a:
        raise PackageError(PX_PKG_REGISTRY_INVALID, "Registry entry missing 'artifact'.")
    if a.startswith("http://") or a.startswith("https://"):
        return a
    if artifact_base.startswith("http://") or artifact_base.startswith("https://"):
        return urljoin(artifact_base, a)
    # local
    return str((Path(artifact_base.rstrip("/")) / a).resolve())


def save_registry_dir(registry_dir: Path, data: Dict[str, Any]) -> None:
    """Write canonical ``torqa-registry.json`` (sorted package list)."""
    registry_dir.mkdir(parents=True, exist_ok=True)
    pkgs = data.get("packages")
    if not isinstance(pkgs, list):
        pkgs = []
    norm: List[Dict[str, Any]] = [p for p in pkgs if isinstance(p, dict)]
    norm.sort(key=lambda x: (str(x.get("name", "")), str(x.get("version", ""))))
    out = {"schema_version": 1, "packages": norm}
    path = registry_dir / REGISTRY_FILENAME
    path.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")

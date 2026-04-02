"""Publish / fetch IR packages against a minimal ``torqa-registry.json`` index."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List

from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from .errors import (
    PX_PKG_ARTIFACT_FAILED,
    PX_PKG_FETCH_FAILED,
    PX_PKG_FINGERPRINT_MISMATCH,
    PackageError,
)
from .fingerprint import compute_package_fingerprint
from .manifest import load_package_manifest
from .registry_index import (
    REGISTRY_FILENAME,
    find_registry_entry,
    load_registry_bundle,
    resolve_artifact_uri,
    save_registry_dir,
)
from .tgz_pack import pack_package_directory, unpack_tgz_from_bytes, unpack_tgz_to_directory


def _sanitize_artifact_basename(name: str, version: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", f"{name}-{version}".replace("/", "-"))
    return (safe.strip("-") or "pkg") + ".tgz"


def publish_package(package_dir: Path, registry_dir: Path) -> Dict[str, Any]:
    """
    Pack ``package_dir`` into ``registry_dir/<sanitized>.tgz`` and upsert registry index.
    Fingerprint is computed from the source directory (before tar).
    """
    package_dir = package_dir.resolve()
    registry_dir = registry_dir.resolve()
    manifest = load_package_manifest(package_dir)
    name = str(manifest["name"])
    version = str(manifest["version"])
    fp = compute_package_fingerprint(package_dir)
    artifact_name = _sanitize_artifact_basename(name, version)
    tgz_path = registry_dir / artifact_name
    pack_package_directory(package_dir, tgz_path)

    reg_file = registry_dir / REGISTRY_FILENAME
    if reg_file.is_file():
        try:
            data = json.loads(reg_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as ex:
            raise PackageError(PX_PKG_ARTIFACT_FAILED, f"Corrupt registry JSON: {ex}") from ex
        if not isinstance(data, dict):
            data = {}
    else:
        data = {}
    pkgs: List[Dict[str, Any]] = [p for p in (data.get("packages") or []) if isinstance(p, dict)]
    pkgs = [p for p in pkgs if not (p.get("name") == name and p.get("version") == version)]
    pkgs.append(
        {
            "name": name,
            "version": version,
            "fingerprint": fp,
            "artifact": artifact_name,
        }
    )
    data["packages"] = pkgs
    save_registry_dir(registry_dir, data)
    return {
        "ok": True,
        "name": name,
        "version": version,
        "fingerprint": fp,
        "artifact": str(tgz_path),
        "registry": str(registry_dir),
    }


def fetch_package(name: str, version: str, registry_spec: str, out_dir: Path) -> Dict[str, Any]:
    """
    Resolve ``name@version`` from registry, obtain ``.tgz``, extract under ``out_dir/<sanitized>/``.
    Verifies fingerprint against registry entry when present.
    """
    out_dir = out_dir.resolve()
    data, artifact_base = load_registry_bundle(registry_spec)
    entry = find_registry_entry(data, name, version)
    uri = resolve_artifact_uri(artifact_base, str(entry.get("artifact") or ""))
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", f"{name}-{version}".replace("/", "-")).strip("-") or "pkg"
    dest = out_dir / safe
    try:
        if uri.startswith("http://") or uri.startswith("https://"):
            with urlopen(uri, timeout=120) as resp:
                body = resp.read()
            unpack_tgz_from_bytes(body, dest)
        else:
            p = Path(uri)
            if not p.is_file():
                raise PackageError(PX_PKG_FETCH_FAILED, f"Artifact not found: {p}")
            unpack_tgz_to_directory(p, dest)
    except (URLError, HTTPError, OSError) as ex:
        shutil.rmtree(dest, ignore_errors=True)
        raise PackageError(PX_PKG_FETCH_FAILED, f"Fetch failed for {uri!r}: {ex}") from ex

    actual_fp = compute_package_fingerprint(dest)
    expected = entry.get("fingerprint")
    if isinstance(expected, str) and expected.strip() and actual_fp != expected:
        shutil.rmtree(dest, ignore_errors=True)
        raise PackageError(
            PX_PKG_FINGERPRINT_MISMATCH,
            f"Package {name!r}@{version!r}: fingerprint mismatch after fetch (expected {expected!r}, got {actual_fp!r}).",
        )
    return {"ok": True, "path": str(dest), "fingerprint": actual_fp, "name": name, "version": version}


def list_registry_packages(registry_spec: str) -> List[Dict[str, Any]]:
    data, _ = load_registry_bundle(registry_spec)
    pkgs = data.get("packages")
    if not isinstance(pkgs, list):
        return []
    out = [p for p in pkgs if isinstance(p, dict)]
    out.sort(key=lambda x: (str(x.get("name", "")), str(x.get("version", ""))))
    return out

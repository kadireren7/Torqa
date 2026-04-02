"""Deterministic package content fingerprint (sha256)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict

from .manifest import list_export_files, load_package_manifest


def compute_package_fingerprint(package_root: Path) -> str:
    """
    Hash manifest (canonical JSON) plus each export file (path + content hash), sorted by export key.
    """
    root = package_root.resolve()
    manifest = load_package_manifest(root)
    # Canonical manifest slice for hashing (only stable fields)
    canon = {
        "name": manifest["name"],
        "version": manifest["version"],
        "ir_version": manifest["ir_version"],
        "exports": dict(sorted((k, manifest["exports"][k]) for k in manifest["exports"])),
    }
    if manifest.get("dependencies"):
        canon["dependencies"] = manifest["dependencies"]
    blob = json.dumps(canon, sort_keys=True, separators=(",", ":")).encode("utf-8")
    h = hashlib.sha256()
    h.update(blob)
    for _key, fpath in list_export_files(root, manifest):
        rel = str(fpath.relative_to(root)).replace("\\", "/")
        data = fpath.read_bytes()
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        h.update(hashlib.sha256(data).digest())
    return "sha256:" + h.hexdigest()

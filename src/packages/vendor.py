"""Copy pinned packages from ``torqa.lock.json`` into ``.torqa/deps`` (verify fingerprint)."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from .errors import (
    PX_PKG_FINGERPRINT_MISMATCH,
    PX_PKG_LOCK_INVALID,
    PX_PKG_NOT_FOUND,
    PX_PKG_SOURCE_UNSUPPORTED,
    PackageError,
)
from .fingerprint import compute_package_fingerprint
from .ref import parse_package_ref, resolve_ref_path
from .tgz_pack import unpack_tgz_to_directory

def _sanitize_target_name(name: str, version: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", f"{name}-{version}".replace("/", "-"))
    return safe.strip("-") or "pkg"


def load_lock(lock_path: Path) -> Dict[str, Any]:
    if not lock_path.is_file():
        raise PackageError(PX_PKG_NOT_FOUND, f"Lock file not found: {lock_path}")
    try:
        data = json.loads(lock_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise PackageError(PX_PKG_LOCK_INVALID, f"Invalid lock JSON: {ex}") from ex
    if not isinstance(data, dict) or "packages" not in data:
        raise PackageError(PX_PKG_LOCK_INVALID, "Lock must be an object with 'packages' array.")
    pkgs = data["packages"]
    if not isinstance(pkgs, list):
        raise PackageError(PX_PKG_LOCK_INVALID, "'packages' must be an array.")
    return data


def _download_url_to_temp_tgz(url: str) -> Path:
    try:
        with urlopen(url, timeout=120) as resp:
            body = resp.read()
    except (URLError, HTTPError, OSError) as ex:
        raise PackageError(PX_PKG_NOT_FOUND, f"Could not download package URL {url!r}: {ex}") from ex
    fd, name = tempfile.mkstemp(suffix=".tgz")
    import os

    with os.fdopen(fd, "wb") as f:
        f.write(body)
    return Path(name)


def _install_package_tree(
    *,
    kind: str,
    loc: str,
    lock_parent: Path,
    dest: Path,
) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    if kind == "path":
        src_dir = resolve_ref_path(loc, lock_parent)
        if not src_dir.is_dir():
            raise PackageError(PX_PKG_NOT_FOUND, f"Package path not found: {src_dir}")
        shutil.copytree(src_dir, dest)
        return

    if kind == "file":
        tgz = resolve_ref_path(loc, lock_parent)
        if not tgz.is_file():
            raise PackageError(PX_PKG_NOT_FOUND, f"Package archive not found: {tgz}")
        try:
            unpack_tgz_to_directory(tgz, dest)
        except PackageError:
            shutil.rmtree(dest, ignore_errors=True)
            raise
        return

    if kind == "url":
        tmp = _download_url_to_temp_tgz(loc)
        try:
            unpack_tgz_to_directory(tmp, dest)
        except PackageError:
            shutil.rmtree(dest, ignore_errors=True)
            raise
        finally:
            tmp.unlink(missing_ok=True)
        return

    raise PackageError(PX_PKG_SOURCE_UNSUPPORTED, f"Unsupported ref kind {kind!r}")


def _resolve_lock_entry(
    pkg: Dict[str, Any],
    i: int,
    lock_parent: Path,
) -> Tuple[str, str]:
    """Return (kind, location) for materialization."""
    ref = pkg.get("ref")
    if isinstance(ref, str) and ref.strip():
        try:
            return parse_package_ref(ref.strip())
        except PackageError as ex:
            raise PackageError(ex.code, f"packages[{i}] ref: {ex}") from ex

    src_mode = pkg.get("source", "path")
    if src_mode != "path":
        raise PackageError(
            PX_PKG_SOURCE_UNSUPPORTED,
            f"packages[{i}]: use source 'path' with source_path, or a single ref: path:/file:/https://…",
        )
    rel = pkg.get("source_path")
    if not isinstance(rel, str) or not rel.strip():
        raise PackageError(PX_PKG_LOCK_INVALID, f"packages[{i}] needs source_path when using source path.")
    return "path", rel


def vendor_packages(lock_path: Path, *, deps_root: Path | None = None) -> Dict[str, Any]:
    """
    For each lock entry, materialize into ``deps_root / <sanitized-name-version>`` and verify fingerprint.

    Lock lines may use either:

    - Legacy: ``"source": "path"``, ``"source_path"`` (relative to lock parent).
    - ``"ref": "path:…"`` | ``"ref": "file:….tgz"`` | ``"ref": "https://…/….tgz"`` (pinned artifact).
    """
    lock_path = lock_path.resolve()
    data = load_lock(lock_path)
    base = lock_path.parent
    if deps_root is None:
        deps_root = base / ".torqa" / "deps"
    deps_root = deps_root.resolve()
    deps_root.mkdir(parents=True, exist_ok=True)

    written: List[str] = []
    resolved: List[Dict[str, Any]] = []

    for i, pkg in enumerate(data["packages"]):
        if not isinstance(pkg, dict):
            raise PackageError(PX_PKG_LOCK_INVALID, f"packages[{i}] must be an object.")
        name = pkg.get("name")
        version = pkg.get("version")
        if not isinstance(name, str) or not isinstance(version, str):
            raise PackageError(PX_PKG_LOCK_INVALID, f"packages[{i}] needs name and version strings.")

        kind, loc = _resolve_lock_entry(pkg, i, base)
        dest_name = _sanitize_target_name(name, version)
        dest = deps_root / dest_name

        try:
            _install_package_tree(kind=kind, loc=loc, lock_parent=base, dest=dest)
        except PackageError:
            shutil.rmtree(dest, ignore_errors=True)
            raise

        actual_fp = compute_package_fingerprint(dest)
        expected = pkg.get("fingerprint")
        if isinstance(expected, str) and expected.strip():
            if actual_fp != expected:
                shutil.rmtree(dest, ignore_errors=True)
                raise PackageError(
                    PX_PKG_FINGERPRINT_MISMATCH,
                    f"Package {name!r}@{version!r}: fingerprint mismatch (expected {expected!r}, got {actual_fp!r}).",
                )
        written.append(str(dest.relative_to(base)))
        resolved.append(
            {
                "name": name,
                "version": version,
                "fingerprint": actual_fp,
                "path": str(dest),
                "relative_under_lock_parent": str(dest.relative_to(base)),
            }
        )

    return {"ok": True, "written": written, "packages": resolved, "deps_root": str(deps_root)}

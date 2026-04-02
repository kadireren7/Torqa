"""Deterministic-enough .tgz pack/unpack for IR packages (fingerprint verified after extract)."""

from __future__ import annotations

import shutil
import tarfile
import tempfile
from pathlib import Path
from typing import List

from .errors import PX_PKG_ARTIFACT_FAILED, PackageError


def _list_files(root: Path) -> List[Path]:
    root = root.resolve()
    files = sorted([p for p in root.rglob("*") if p.is_file()], key=lambda p: p.relative_to(root).as_posix())
    return files


def pack_package_directory(package_root: Path, tgz_path: Path) -> None:
    """Write gzip tar of package files with sorted member order (paths relative to package root)."""
    package_root = package_root.resolve()
    if not (package_root / "torqa.package.json").is_file():
        raise PackageError(PX_PKG_ARTIFACT_FAILED, f"Not a package root (missing torqa.package.json): {package_root}")
    files = _list_files(package_root)
    tgz_path.parent.mkdir(parents=True, exist_ok=True)
    if tgz_path.exists():
        tgz_path.unlink()
    with tarfile.open(tgz_path, "w:gz") as tf:
        for fp in files:
            arc = fp.relative_to(package_root).as_posix()
            tf.add(str(fp), arcname=arc, recursive=False)


def unpack_tgz_to_directory(tgz_path: Path, dest_dir: Path) -> None:
    """Extract archive; package root (torqa.package.json) must end up at dest_dir."""
    if not tgz_path.is_file():
        raise PackageError(PX_PKG_ARTIFACT_FAILED, f"Archive not found: {tgz_path}")
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    try:
        with tarfile.open(tgz_path, "r:*") as tf:
            tf.extractall(dest_dir)
    except tarfile.TarError as ex:
        raise PackageError(PX_PKG_ARTIFACT_FAILED, f"Invalid tar archive {tgz_path}: {ex}") from ex
    if not (dest_dir / "torqa.package.json").is_file():
        raise PackageError(
            PX_PKG_ARTIFACT_FAILED,
            f"Archive must contain torqa.package.json at root; got: {dest_dir}",
        )


def unpack_tgz_from_bytes(data: bytes, dest_dir: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        tmp.write(data)
        p = Path(tmp.name)
    try:
        unpack_tgz_to_directory(p, dest_dir)
    finally:
        p.unlink(missing_ok=True)

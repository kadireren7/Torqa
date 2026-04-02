"""Single unambiguous ``ref`` string for lock entries (path / local archive / URL)."""

from __future__ import annotations

from pathlib import Path

from .errors import PX_PKG_REF_INVALID, PackageError


def parse_package_ref(ref: str) -> tuple[str, str]:
    """
    Return ``(kind, location)`` where kind is ``path`` | ``file`` | ``url``.

    - ``path:<rel-or-abs-dir>`` — directory package (same as legacy source path).
    - ``file:<rel-or-abs.tgz>`` — local ``.tgz`` tarball (package root files at archive root).
    - ``https://...`` or ``http://...`` — URL to a ``.tgz`` (same layout).

    No semver ranges; one pinned artifact per lock line.
    """
    r = (ref or "").strip()
    if not r:
        raise PackageError(PX_PKG_REF_INVALID, "ref must be non-empty.")
    lower = r.lower()
    if lower.startswith("path:"):
        loc = r[5:].strip()
        if not loc:
            raise PackageError(PX_PKG_REF_INVALID, "path: ref needs a path after path:")
        return "path", loc
    if lower.startswith("file:"):
        loc = r[5:].strip()
        if not loc:
            raise PackageError(PX_PKG_REF_INVALID, "file: ref needs a path after file:")
        return "file", loc
    if r.startswith("https://") or r.startswith("http://"):
        return "url", r
    raise PackageError(
        PX_PKG_REF_INVALID,
        f"Invalid ref {ref!r}: use path:DIR, file:ARCHIVE.tgz, or https://.../archive.tgz",
    )


def resolve_ref_path(loc: str, lock_parent: Path) -> Path:
    """Resolve path: or file: location relative to lock file parent when not absolute."""
    p = Path(loc)
    if p.is_absolute():
        return p.resolve()
    return (lock_parent / p).resolve()

"""Human-readable package/compose CLI failures: ERROR, Why, Fix, Example, Try."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, Tuple

from .errors import (
    PX_PKG_ARTIFACT_FAILED,
    PX_PKG_COMPOSE_SPEC,
    PX_PKG_FETCH_FAILED,
    PX_PKG_FINGERPRINT_MISMATCH,
    PX_PKG_LOCK_INVALID,
    PX_PKG_MANIFEST_INVALID,
    PX_PKG_MERGE_CONDITION_ID_COLLISION,
    PX_PKG_MERGE_FORBIDDEN_KEY,
    PX_PKG_MERGE_INPUT_CONFLICT,
    PX_PKG_NOT_FOUND,
    PX_PKG_REF_INVALID,
    PX_PKG_REGISTRY_INVALID,
    PX_PKG_SOURCE_UNSUPPORTED,
    PackageError,
)

# Canonical IR-package flow (docs/USING_PACKAGES.md) — keep hints aligned.
_TRY_COMPOSE = "torqa compose examples/package_demo/compose.json --out composed.json"
_TRY_FINGERPRINT = "torqa package-fingerprint examples/packages/minimal_auth"
_TRY_VENDOR = "torqa vendor --lock examples/package_demo/torqa.lock.json"
_TRY_PACKAGES_DOC = "docs/USING_PACKAGES.md"
_TRY_PACKAGE_PUBLISH = "torqa package publish PATH --registry ./registry"
_TRY_PACKAGE_FETCH = "torqa package fetch NAME VERSION --registry ./registry --out ./deps"

_COMPOSE_MIN_EXAMPLE = (
    '{"primary":"primary.json","fragments":["../packages/my_pkg/exports/frag.json"],'
    '"library_refs_from_lock":true,"lock":"torqa.lock.json"}'
)


def _compose_shape_hint() -> str:
    return f"Minimal compose.json shape: {_COMPOSE_MIN_EXAMPLE} (see examples/package_demo/compose.json)"


def _package_hint(
    code: str,
    msg: str,
    *,
    compose_spec_dir: Optional[Path] = None,
) -> Tuple[str, str, str, str]:
    """Returns (why, fix, example, try_cmd)."""
    if code == PX_PKG_NOT_FOUND:
        if "Lock file not found" in msg:
            return (
                "vendor/compose need a torqa.lock.json on disk at the path you passed.",
                "Use an existing lock path, or create one next to compose.json (copy examples/package_demo/torqa.lock.json).",
                "examples/package_demo/torqa.lock.json",
                _TRY_VENDOR,
            )
        if "Package path not found" in msg:
            m = re.search(r"Package path not found:\s*(.+)$", msg)
            tried = m.group(1).strip() if m else msg
            return (
                "Lock source_path is resolved from the lock file’s directory, not cwd; the folder is missing or the path is wrong.",
                f'Open torqa.lock.json beside that lock and set "source_path" to a relative path that exists (e.g. "../packages/my_pkg").',
                f"Resolved: {tried}",
                _TRY_VENDOR,
            )
        if "torqa.package.json not found" in msg:
            return (
                "package-fingerprint expects a directory that already contains torqa.package.json (an IR package root).",
                "Pass the package folder that has the manifest, not a parent repo root.",
                "examples/packages/minimal_auth/",
                _TRY_FINGERPRINT,
            )
        if "Package export" in msg and "is not a file" in msg:
            return (
                "The manifest exports map points at a JSON file that is missing or not a file.",
                'Under torqa.package.json, fix each exports value to a real path (e.g. "exports/fragment.json").',
                'exports: { "email_fragment": "exports/email_input.json" }',
                _TRY_FINGERPRINT,
            )
        if "Compose spec not found" in msg:
            return (
                "torqa compose needs a compose.json file at the path you gave.",
                "Pass the path to compose.json (relative to cwd is fine).",
                "examples/package_demo/compose.json",
                _TRY_COMPOSE,
            )
        return (
            "A path required for package/compose tooling is missing or wrong.",
            "Confirm files exist; paths in compose.json are relative to compose.json’s folder.",
            _compose_shape_hint(),
            _TRY_COMPOSE,
        )

    if code == PX_PKG_COMPOSE_SPEC:
        if "Invalid compose JSON" in msg or "Compose spec must" in msg:
            return (
                "compose.json must be one JSON object with primary (and usually fragments, lock).",
                "Fix JSON syntax; required field: non-empty string primary.",
                _compose_shape_hint(),
                _TRY_COMPOSE,
            )
        if "requires non-empty 'primary'" in msg:
            return (
                "compose.json must name your app IR bundle file.",
                'Set "primary" to a .json bundle (relative to compose.json unless absolute).',
                '"primary": "../core/valid_minimal_flow.json"',
                _TRY_COMPOSE,
            )
        if "'fragments' must be an array" in msg:
            return (
                "If fragments is present it must be a JSON array of paths (or use [] for none).",
                'Use "fragments": ["../packages/minimal_auth/exports/email_input.json"]',
                "examples/package_demo/compose.json",
                _TRY_COMPOSE,
            )
        if "library_refs_from_lock requires" in msg:
            return (
                "library_refs_from_lock needs a lock file path in the same spec.",
                'Add "lock": "torqa.lock.json" next to compose.json (or a relative path to it).',
                "examples/package_demo/compose.json",
                _TRY_COMPOSE,
            )
        if "Each fragment path must be a string" in msg:
            return (
                "Every fragments entry must be a string path, not a number or object.",
                '"fragments": ["exports/part.json"]',
                "examples/package_demo/compose.json",
                _TRY_COMPOSE,
            )
        if "Invalid bundle JSON" in msg or "Expected object" in msg:
            rel = msg
            if compose_spec_dir and "Invalid bundle JSON" in msg:
                m = re.search(r"Invalid bundle JSON\s+(.+?):", msg)
                if m:
                    rel = m.group(1).strip()
            return (
                "primary must be a full IR bundle object; each fragment must be a JSON object (mergeable slice).",
                "Ensure files exist under paths relative to compose.json; valid JSON object in each file.",
                rel,
                _TRY_COMPOSE,
            )
        return (
            "compose.json or a referenced bundle/fragment failed validation when loading.",
            "Compare fields to examples/package_demo/compose.json.",
            _compose_shape_hint(),
            _TRY_COMPOSE,
        )

    if code == PX_PKG_MERGE_FORBIDDEN_KEY:
        if "Primary bundle must contain ir_goal" in msg:
            return (
                "compose merges into ir_goal; primary must be a bundle wrapper, not a bare fragment.",
                "Use { \"ir_goal\": { ... } } as top level, or run torqa surface / use examples/core/*.json.",
                "torqa language --minimal-json",
                _TRY_COMPOSE,
            )
        if "Fragment" in msg and "forbidden keys" in msg:
            return (
                "IR merge only allows fragment keys: inputs, preconditions, forbids, postconditions (not goal/transitions/metadata).",
                "Split full bundles: keep structure in primary; put only mergeable slices in fragment files.",
                '{"inputs":[...],"preconditions":[...]}',
                _TRY_PACKAGES_DOC,
            )
        if "must be an array" in msg:
            return (
                "Inside a fragment, preconditions/forbids/postconditions must be JSON arrays.",
                "Use [] or a list of condition objects with condition_id.",
                '[{"condition_id":"c_req_0002","kind":"require",...}]',
                _TRY_PACKAGES_DOC,
            )
        return (
            "Primary or fragment shape does not match merge rules.",
            "See docs/USING_PACKAGES.md (fragment rules) and examples/package_demo.",
            _compose_shape_hint(),
            _TRY_COMPOSE,
        )

    if code == PX_PKG_MERGE_CONDITION_ID_COLLISION:
        return (
            "After merge, every precondition/forbid/postcondition condition_id must be unique across primary + all fragments.",
            "Renumber conflicting ids in the fragment (e.g. c_req_0002) so they do not repeat any id in primary or other fragments.",
            "docs/USING_PACKAGES.md — “Pin and wire” step + id note",
            _TRY_COMPOSE,
        )

    if code == PX_PKG_MERGE_INPUT_CONFLICT:
        return (
            "The same input name appears in primary and a fragment with different types.",
            "Rename the input in the fragment or align types to match the primary bundle.",
            '{"name": "email", "type": "text"}',
            _TRY_COMPOSE,
        )

    if code == PX_PKG_FINGERPRINT_MISMATCH:
        return (
            "torqa.lock.json stores a content fingerprint; it no longer matches the package on disk (manifest or export files changed).",
            "Run torqa package-fingerprint on the package root and paste the printed sha256 into the lock entry for that package.",
            _TRY_FINGERPRINT,
            f"{_TRY_FINGERPRINT} && edit torqa.lock.json fingerprint field",
        )

    if code == PX_PKG_LOCK_INVALID:
        return (
            "The lock file is not valid JSON or does not have the expected packages array shape.",
            'Use {"packages": [ { "name", "version", "source": "path", "source_path", "fingerprint"? }, ... ] }.',
            "examples/package_demo/torqa.lock.json",
            _TRY_VENDOR,
        )

    if code == PX_PKG_MANIFEST_INVALID:
        return (
            "torqa.package.json is missing required fields or has wrong ir_version/exports shape.",
            "Match name, version, ir_version to the toolchain; exports must be non-empty string paths.",
            "examples/packages/minimal_auth/torqa.package.json",
            _TRY_FINGERPRINT,
        )

    if code == PX_PKG_REF_INVALID:
        return (
            "Lock ref must use one of the supported forms (single string, no version ranges).",
            'Use path:REL_DIR, file:ARCHIVE.tgz, or https://host/pkg.tgz',
            'ref: "path:.torqa/deps/torqa-minimal-auth-1.0.0"',
            "docs/PACKAGE_DISTRIBUTION.md",
        )

    if code == PX_PKG_REGISTRY_INVALID:
        return (
            "The registry index JSON is missing, malformed, or missing a packages array.",
            "Use torqa package publish to create/update a local registry, or fix torqa-registry.json.",
            '{"schema_version":1,"packages":[{"name","version","fingerprint","artifact"}]}',
            _TRY_PACKAGE_PUBLISH,
        )

    if code == PX_PKG_FETCH_FAILED:
        return (
            "The artifact could not be downloaded or read (network, path, or HTTP error).",
            "Check registry artifact field, URL, and that the file is a .tgz produced by torqa package publish.",
            "torqa package list --registry ./registry",
            _TRY_PACKAGE_FETCH,
        )

    if code == PX_PKG_ARTIFACT_FAILED:
        return (
            "Packing or unpacking a .tgz failed, or the archive does not contain a valid package root.",
            "Publish from a folder that contains torqa.package.json; archives must place that file at the tar root.",
            "torqa package publish examples/packages/minimal_auth --registry ./registry",
            _TRY_PACKAGE_PUBLISH,
        )

    if code == PX_PKG_SOURCE_UNSUPPORTED:
        return (
            "Legacy lock entries must use source \"path\" with source_path, or switch to ref: path:/file:/https:…",
            'Prefer "ref": "path:../packages/my_pkg" or keep "source": "path", "source_path": "…"',
            "docs/PACKAGE_DISTRIBUTION.md",
            _TRY_VENDOR,
        )

    return (
        "Package or compose step failed; see code and message above.",
        "Follow the canonical flow in docs/USING_PACKAGES.md (create → pin → compose spec → compose → build).",
        _compose_shape_hint(),
        _TRY_COMPOSE,
    )


def format_package_cli_error(
    ex: PackageError,
    *,
    compose_spec_dir: Optional[Path] = None,
) -> str:
    why, fix, example, try_cmd = _package_hint(ex.code, str(ex), compose_spec_dir=compose_spec_dir)
    return "\n".join(
        [
            "ERROR:",
            f"✖ {ex.code}: {ex}",
            f"→ Why: {why}",
            f"→ Fix: {fix}",
            f"→ Example: {example}",
            f"Try: {try_cmd}",
        ]
    )

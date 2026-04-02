"""Merge IR goal fragments into a primary ``ir_goal`` (build-time, deterministic)."""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Set

from .errors import (
    PX_PKG_MERGE_CONDITION_ID_COLLISION,
    PX_PKG_MERGE_FORBIDDEN_KEY,
    PX_PKG_MERGE_INPUT_CONFLICT,
    PackageError,
)

# v1: structural merge only on these sections (no goal/transitions/result/metadata from fragments).
_MERGEABLE_KEYS = frozenset({"inputs", "preconditions", "forbids", "postconditions"})


def _collect_condition_ids(goal: Dict[str, Any]) -> Set[str]:
    ids: Set[str] = set()
    for key in ("preconditions", "forbids", "postconditions"):
        for row in goal.get(key) or []:
            cid = row.get("condition_id")
            if isinstance(cid, str):
                ids.add(cid)
    return ids


def merge_ir_goal_fragments(primary_goal: Dict[str, Any], fragments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Deep-copy ``primary_goal`` and merge each fragment dict.

    Each fragment may only contain keys in ``inputs`` | ``preconditions`` | ``forbids`` | ``postconditions``.
    ``condition_id`` values must remain globally unique after merge.
    """
    out = copy.deepcopy(primary_goal)
    seen_ids = _collect_condition_ids(out)

    for fi, frag in enumerate(fragments):
        if not isinstance(frag, dict):
            raise PackageError(PX_PKG_MERGE_FORBIDDEN_KEY, f"Fragment {fi} must be a JSON object.")
        bad = set(frag.keys()) - _MERGEABLE_KEYS
        if bad:
            raise PackageError(
                PX_PKG_MERGE_FORBIDDEN_KEY,
                f"Fragment {fi} has forbidden keys {sorted(bad)!r}; allowed: {sorted(_MERGEABLE_KEYS)!r}.",
            )
        # inputs: merge by name; same name must have same type
        if "inputs" in frag:
            by_name = {x["name"]: x for x in out.get("inputs") or [] if isinstance(x, dict) and "name" in x}
            for row in frag["inputs"]:
                if not isinstance(row, dict) or "name" not in row:
                    continue
                n = row["name"]
                if n in by_name:
                    if by_name[n].get("type") != row.get("type"):
                        raise PackageError(
                            PX_PKG_MERGE_INPUT_CONFLICT,
                            f"Fragment {fi}: input {n!r} type conflicts with primary.",
                        )
                else:
                    out.setdefault("inputs", []).append(copy.deepcopy(row))
                    by_name[n] = row
        for key in ("preconditions", "forbids", "postconditions"):
            if key not in frag:
                continue
            rows = frag[key]
            if not isinstance(rows, list):
                raise PackageError(PX_PKG_MERGE_FORBIDDEN_KEY, f"Fragment {fi}: {key} must be an array.")
            for row in rows:
                if not isinstance(row, dict):
                    continue
                cid = row.get("condition_id")
                if isinstance(cid, str):
                    if cid in seen_ids:
                        raise PackageError(
                            PX_PKG_MERGE_CONDITION_ID_COLLISION,
                            f"Fragment {fi}: duplicate condition_id {cid!r} after merge.",
                        )
                    seen_ids.add(cid)
                out.setdefault(key, []).append(copy.deepcopy(row))
    if out.get("inputs"):
        out["inputs"] = sorted(out["inputs"], key=lambda x: str(x.get("name", "")))
    return out


def compose_bundle(
    primary_bundle: Dict[str, Any],
    fragments: List[Dict[str, Any]],
    *,
    library_refs: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """Return new bundle with merged ``ir_goal`` and optional ``library_refs`` (sorted for determinism)."""
    if "ir_goal" not in primary_bundle or not isinstance(primary_bundle["ir_goal"], dict):
        raise PackageError(PX_PKG_MERGE_FORBIDDEN_KEY, "Primary bundle must contain ir_goal object.")
    out: Dict[str, Any] = {"ir_goal": merge_ir_goal_fragments(primary_bundle["ir_goal"], fragments)}
    refs: List[Dict[str, Any]] = []
    if primary_bundle.get("library_refs"):
        refs.extend(copy.deepcopy(primary_bundle["library_refs"]))
    if library_refs:
        refs.extend(copy.deepcopy(library_refs))
    if refs:
        # Dedup by (name, version), last wins for fingerprint
        by: Dict[tuple[str, str], Dict[str, Any]] = {}
        for r in refs:
            if isinstance(r, dict) and isinstance(r.get("name"), str) and isinstance(r.get("version"), str):
                by[(r["name"], r["version"])] = r
        out["library_refs"] = sorted(by.values(), key=lambda x: (x["name"], x["version"]))
    return out

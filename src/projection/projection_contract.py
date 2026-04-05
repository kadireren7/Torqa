"""
P20 / P124: machine-readable projection / materialization contract summaries.

Used for JSON ``build`` / ``project`` output and per-artifact ``torqa_projection`` envelopes.
TORQA IR remains the source of truth; target stacks are labeled projections.

TODO(P18+): richer per-surface consistency signals may move next to a Rust projection core;
keep this module as a thin JSON contract over orchestrator artifacts.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from src.ir.canonical_ir import IRGoal

TORQA_PROJECTION_SCHEMA_VERSION = "p124.1"

# Stable ids for materialized stacks (file layout + codegen family).
TARGET_STACK_TYPESCRIPT_WEBAPP = "typescript_webapp"
TARGET_STACK_TYPESCRIPT_IR_STUB = "typescript_ir_stub"
TARGET_STACK_PYTHON_STUB = "python_service_stub"
TARGET_STACK_RUST_STUB = "rust_runtime_stub"
TARGET_STACK_SQL_SURFACE = "sql_data_layer"
TARGET_STACK_INTEGRATION_MANIFEST = "integration_manifest"


def collect_top_level_paths(filenames: List[str]) -> List[str]:
    """Sorted unique first path segment (POSIX-style) for inspectability."""
    tops: set[str] = set()
    for fn in filenames:
        s = str(fn).replace("\\", "/").strip()
        if not s or s.startswith("/"):
            continue
        top = s.split("/")[0]
        if top:
            tops.add(top)
    return sorted(tops)


def normalize_projection_metadata(artifact: Dict[str, Any]) -> Dict[str, Any]:
    """Stable keys for each orchestrator artifact envelope (P20)."""
    tl = artifact.get("target_language")
    if not isinstance(tl, str) or not tl.strip():
        tl = "unknown"
    purp = artifact.get("purpose")
    if not isinstance(purp, str) or not purp.strip():
        purp = "unknown"
    raw = artifact.get("warnings")
    if raw is None:
        warnings: List[str] = []
    elif isinstance(raw, list):
        warnings = [str(x) for x in raw]
    else:
        warnings = [str(raw)]
    out: Dict[str, Any] = {
        "target_language": tl.strip(),
        "purpose": purp.strip(),
        "warnings": warnings,
    }
    tp = artifact.get("torqa_projection")
    if isinstance(tp, dict) and tp:
        out["torqa_projection"] = {
            "schema_version": str(tp.get("schema_version") or ""),
            "target_stack": str(tp.get("target_stack") or ""),
            "role": str(tp.get("role") or ""),
            "deterministic": bool(tp.get("deterministic", True)),
            "source": str(tp.get("source") or "ir_goal"),
            "emit_paths_sorted": list(tp.get("emit_paths_sorted") or []),
        }
    return out


def sorted_emit_paths(artifact: Dict[str, Any]) -> List[str]:
    files = artifact.get("files")
    if not isinstance(files, list):
        return []
    paths: List[str] = []
    for f in files:
        if isinstance(f, dict) and isinstance(f.get("filename"), str):
            paths.append(str(f["filename"]).replace("\\", "/"))
    return sorted(paths)


def enrich_artifact_with_torqa_projection(
    artifact: Dict[str, Any],
    *,
    target_stack: str,
    role: str = "materialized_surface",
) -> None:
    """Attach P124 envelope in-place (deterministic layout + stable naming)."""
    artifact["torqa_projection"] = {
        "schema_version": TORQA_PROJECTION_SCHEMA_VERSION,
        "target_stack": target_stack,
        "role": role,
        "deterministic": True,
        "source": "ir_goal",
        "emit_paths_sorted": sorted_emit_paths(artifact),
    }


def build_p124_projection_manifest_artifact(ir_goal: IRGoal, artifacts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Single JSON file summarizing all surfaces for integration / audits (appended last)."""
    from src.projection.semantic_fingerprint import ir_semantic_fingerprint

    surfaces: List[Dict[str, Any]] = []
    for raw in artifacts:
        if not isinstance(raw, dict):
            continue
        tp = raw.get("torqa_projection") if isinstance(raw.get("torqa_projection"), dict) else {}
        surfaces.append(
            {
                "target_stack": tp.get("target_stack"),
                "target_language": raw.get("target_language"),
                "purpose": raw.get("purpose"),
                "paths": sorted_emit_paths(raw),
            }
        )
    surfaces.sort(key=lambda x: (str(x.get("target_stack") or ""), str(x.get("purpose") or "")))
    body = {
        "manifest_version": TORQA_PROJECTION_SCHEMA_VERSION,
        "ir_semantics": ir_semantic_fingerprint(ir_goal),
        "surfaces": surfaces,
    }
    content = json.dumps(body, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    manifest: Dict[str, Any] = {
        "target_language": "python",
        "purpose": "tooling_bridge",
        "warnings": ["p124_projection_manifest"],
        "files": [{"filename": "generated/torqa/p124_projection_manifest.json", "content": content}],
    }
    enrich_artifact_with_torqa_projection(
        manifest,
        target_stack=TARGET_STACK_INTEGRATION_MANIFEST,
        role="run_summary",
    )
    return manifest


def _emittable_file_entries(files: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(files, list):
        return out
    for f in files:
        if not isinstance(f, dict):
            continue
        fn = f.get("filename")
        content = f.get("content")
        if not fn or not isinstance(content, str):
            continue
        out.append(f)
    return out


def summarize_projection_surfaces(
    artifacts: List[Dict[str, Any]],
    *,
    consistency_errors: List[str],
) -> List[Dict[str, Any]]:
    """
    One summary dict per emitted surface (orchestrator artifact).

    ``consistency_ok`` reflects **global** projection consistency (same for all rows when
    ``consistency_errors`` is shared across the run).
    """
    global_ok = len(consistency_errors or []) == 0
    summaries: List[Dict[str, Any]] = []
    for raw in artifacts:
        if not isinstance(raw, dict):
            continue
        meta = normalize_projection_metadata(raw)
        entries = _emittable_file_entries(raw.get("files"))
        fnames = [str(e["filename"]).replace("\\", "/") for e in entries]
        summaries.append(
            {
                "target_language": meta["target_language"],
                "purpose": meta["purpose"],
                "file_count": len(entries),
                "top_level_paths": collect_top_level_paths(fnames),
                "warnings": list(meta["warnings"]),
                "consistency_ok": global_ok,
            }
        )
    return summaries

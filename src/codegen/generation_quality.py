"""Artifact / generation quality reporting."""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

from src.codegen.artifact_builder import can_generate_simple_website, validate_generated_artifacts
from src.ir.canonical_ir import IRGoal
from src.projection.projection_strategy import ProjectionPlan


def build_generation_quality_report(
    ir_goal: IRGoal,
    projection_plan: ProjectionPlan,
    artifacts: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    quality_errors = validate_generated_artifacts(artifacts)
    website = can_generate_simple_website(ir_goal, projection_plan, list(artifacts))
    by_lang: Dict[str, int] = {}
    by_purpose: Dict[str, int] = {}
    file_count = 0
    non_empty_files = 0
    for art in artifacts:
        lang = str(art.get("target_language") or "unknown")
        purp = str(art.get("purpose") or "unknown")
        by_lang[lang] = by_lang.get(lang, 0) + 1
        by_purpose[purp] = by_purpose.get(purp, 0) + 1
        for f in art.get("files") or []:
            file_count += 1
            c = f.get("content")
            if isinstance(c, str) and c.strip():
                non_empty_files += 1

    return {
        "artifact_group_count": len(artifacts),
        "file_count": file_count,
        "non_empty_file_count": non_empty_files,
        "by_target_language": by_lang,
        "by_purpose": by_purpose,
        "validate_generated_artifacts_errors": quality_errors,
        "artifact_validation_ok": len(quality_errors) == 0,
        "website_threshold": website,
        "readiness": {
            "passes_artifact_validation": len(quality_errors) == 0,
            "passes_website_threshold": bool(website.get("passed")),
        },
    }

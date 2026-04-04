"""
P78 — Large-scale token proof: synthetic NL + baseline vs minimal validated `.tq`.

No huge blobs on disk: repeated structured units from ``examples/benchmarks/scale/_shared/``,
expanded in memory to token floors using the same ``utf8_bytes_div_4_v1`` estimator.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Tuple

from src.benchmarks.token_estimate import ESTIMATOR_ID, ESTIMATOR_METHOD_EN, estimate_tokens
from src.benchmarks.token_proof import measure_scenario

TOKEN_PROOF_SCALE_SCHEMA_VERSION = 2
TOKEN_PROOF_SCALE_SUITE_ID = "token_proof_scale_v1"


def _round_ratio(num: float) -> float:
    return round(float(num), 6)


def _build_ratio_stability(scale_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Across scale tiers: TORQA surface + IR expansion should stay flat; prompt/surface compression
    ratios should grow monotonically as synthetic NL size grows (deterministic stress test).
    """
    ok = [dict(r) for r in scale_results if r.get("ok")]
    ok.sort(key=lambda r: int(r.get("size_rank", 0)))
    n = len(ok)
    if n < 2:
        return {
            "insufficient_passing_tiers": True,
            "passing_tier_count": n,
            "interpretation_en": "Need at least two passing tiers to assess ratio stability across scale.",
        }

    tts = [int(r["torqa_tokens"]) for r in ok]
    tt_min, tt_max = min(tts), max(tts)
    tt_spread = tt_max - tt_min
    tt_mean = sum(tts) / n
    tt_var = sum((x - tt_mean) ** 2 for x in tts) / n
    tt_std = math.sqrt(tt_var)
    tt_cv = _round_ratio(tt_std / tt_mean) if tt_mean > 0 else None

    ratios = [float(r["compression_ratio"]) for r in ok if r.get("compression_ratio") is not None]
    comb = [float(r["compression_ratio_combined"]) for r in ok if r.get("compression_ratio_combined") is not None]
    irs = [float(r["ir_to_torqa_ratio"]) for r in ok if r.get("ir_to_torqa_ratio") is not None]

    eps = 1e-9
    cr_mono = n < 2 or (
        len(ratios) == n and all(ratios[i] <= ratios[i + 1] + eps for i in range(n - 1))
    )
    comb_mono = n < 2 or (
        len(comb) == n and all(comb[i] <= comb[i + 1] + eps for i in range(n - 1))
    )
    ir_spread = (max(irs) - min(irs)) if len(irs) >= 2 else 0.0
    ir_stable = len(irs) < 2 or ir_spread < 1e-6

    return {
        "passing_tier_count": n,
        "torqa_tokens_min": tt_min,
        "torqa_tokens_max": tt_max,
        "torqa_tokens_spread": tt_spread,
        "torqa_tokens_std_population": _round_ratio(tt_std),
        "torqa_tokens_coefficient_of_variation": tt_cv,
        "torqa_surface_token_stable_across_scale": tt_spread == 0,
        "compression_ratio_monotonic_non_decreasing": cr_mono,
        "compression_ratio_range_across_tiers": _round_ratio(max(ratios) - min(ratios)) if ratios else None,
        "combined_compression_ratio_monotonic_non_decreasing": comb_mono,
        "ir_to_torqa_ratio_spread_across_tiers": _round_ratio(ir_spread) if irs else None,
        "ir_expansion_ratio_stable_across_scale": ir_stable,
        "interpretation_en": (
            "Stable TORQA surface: torqa_tokens and ir_to_torqa_ratio should not drift across tiers "
            "(same app.tq). compression_ratio and combined ratio should grow monotonically as synthetic "
            "prompt/baseline size grows — predictable scaling, not random drift."
        ),
    }


def _load_scale_manifest(repo_root: Path) -> Dict[str, Any]:
    p = repo_root / "examples" / "benchmarks" / "scale" / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8"))


def _load_shared(repo_root: Path, manifest: Dict[str, Any]) -> Tuple[str, str]:
    rel = str(manifest.get("shared_dir_relative") or "examples/benchmarks/scale/_shared")
    base = (repo_root / rel).resolve()
    nl = (base / "nl_repeat_unit.md").read_text(encoding="utf-8")
    code = (base / "baseline_repeat_unit.txt").read_text(encoding="utf-8")
    return nl.strip() + "\n", code.strip() + "\n"


def _load_scale_target(scenario_dir: Path) -> Dict[str, Any]:
    p = scenario_dir / "scale_target.json"
    return json.loads(p.read_text(encoding="utf-8"))


def expand_to_token_floor(header: str, unit: str, target_tokens: int) -> str:
    """
    Deterministically repeat ``unit`` with indexed headings until ``estimate_tokens(full) >= target_tokens``.
    Uses fixed-width indices so every chunk has identical UTF-8 length → O(1) token estimate per chunk after first sample.
    """
    unit = unit.rstrip() + "\n"
    sep = "\n\n---\n\n"
    line_prefix = "## Hierarchical depth "
    chunk0 = f"{line_prefix}{0:09d}\n{unit}{sep}"
    ct = estimate_tokens(chunk0)
    ht = estimate_tokens(header)
    if ht >= target_tokens:
        return header
    need = max(0, target_tokens - ht)
    n = max(1, (need + ct - 1) // ct)
    parts: List[str] = [header.rstrip(), sep]
    for i in range(n):
        parts.append(f"{line_prefix}{i:09d}\n{unit}{sep}")
    text = "".join(parts)
    j = n
    guard = 0
    while estimate_tokens(text) < target_tokens and guard < 256:
        parts.append(f"{line_prefix}{j:09d}\n{unit}{sep}")
        text = "".join(parts)
        j += 1
        guard += 1
    return text


def build_synthetic_prompt_and_baseline(
    repo_root: Path,
    scenario: Dict[str, Any],
    nl_unit: str,
    code_unit: str,
) -> Tuple[str, str, Dict[str, Any]]:
    rel_dir = str(scenario["relative_dir"])
    base = (repo_root / rel_dir).resolve()
    targets = _load_scale_target(base)
    task_header = (base / "TASK.md").read_text(encoding="utf-8")
    baseline_header = (base / "BASELINE_CODE.txt").read_text(encoding="utf-8")
    p_floor = int(targets["target_prompt_tokens_floor"])
    b_floor = int(targets["target_baseline_tokens_floor"])
    prompt_text = expand_to_token_floor(task_header, nl_unit, p_floor)
    baseline_text = expand_to_token_floor(baseline_header, code_unit, b_floor)
    meta = {
        "target_prompt_tokens_floor": p_floor,
        "target_baseline_tokens_floor": b_floor,
        "synthetic_pattern_version": int(targets.get("synthetic_pattern_version", 1)),
    }
    return prompt_text, baseline_text, meta


def build_token_proof_scale_report(
    repo_root: Path,
    *,
    synthetic_token_estimation: bool = True,
) -> Dict[str, Any]:
    repo_root = repo_root.resolve()
    manifest = _load_scale_manifest(repo_root)
    scenarios_in = sorted(
        list(manifest.get("scenarios") or []),
        key=lambda s: int(s.get("size_rank", 0)),
    )
    nl_unit, code_unit = _load_shared(repo_root, manifest)

    full_rows: List[Dict[str, Any]] = []
    scale_results: List[Dict[str, Any]] = []

    for sc in scenarios_in:
        if synthetic_token_estimation:
            prompt_text, baseline_text, tmeta = build_synthetic_prompt_and_baseline(
                repo_root,
                sc,
                nl_unit,
                code_unit,
            )
            row = measure_scenario(
                repo_root,
                sc,
                override_prompt_text=prompt_text,
                override_baseline_text=baseline_text,
            )
            row["synthetic"] = {
                "enabled": True,
                **tmeta,
            }
        else:
            row = measure_scenario(repo_root, sc)
            row["synthetic"] = {"enabled": False}

        full_rows.append(row)

        tc = row.get("token_counts") or {}
        pt = int(tc.get("prompt_tokens") or 0)
        tt = int(tc.get("torqa_tokens") or 0)
        ratio = _round_ratio(pt / max(1, tt)) if row.get("ok") else None
        red = _round_ratio(100.0 * (pt - tt) / pt) if row.get("ok") and pt > 0 else None
        cr_comb = row.get("compression_ratio_combined_per_torqa") if row.get("ok") else None
        ir_tq = row.get("ir_to_torqa_ratio") if row.get("ok") else None

        scale_results.append(
            {
                "size": str(sc.get("size", "")),
                "size_rank": int(sc.get("size_rank", 0)),
                "target_prompt_tokens_floor": (row.get("synthetic") or {}).get("target_prompt_tokens_floor"),
                "prompt_tokens": pt,
                "torqa_tokens": tt,
                "baseline_code_tokens": int(tc.get("baseline_code_tokens") or 0),
                "reduction_percent": red,
                "compression_ratio": ratio,
                "compression_ratio_combined": cr_comb,
                "ir_to_torqa_ratio": ir_tq,
                "ok": bool(row.get("ok")),
            },
        )

    ok = [r for r in full_rows if r.get("ok")]
    failed = [r for r in full_rows if not r.get("ok")]

    pts = [int((r.get("token_counts") or {}).get("prompt_tokens") or 0) for r in ok]
    bts = [int((r.get("token_counts") or {}).get("baseline_code_tokens") or 0) for r in ok]
    prompt_non_dec = all(pts[i] <= pts[i + 1] for i in range(len(pts) - 1)) if len(pts) > 1 else True
    baseline_non_dec = all(bts[i] <= bts[i + 1] for i in range(len(bts) - 1)) if len(bts) > 1 else True
    ratio_stability = _build_ratio_stability(scale_results)

    return {
        "schema_version": TOKEN_PROOF_SCALE_SCHEMA_VERSION,
        "suite_id": TOKEN_PROOF_SCALE_SUITE_ID,
        "scale_mode": True,
        "synthetic_token_estimation": bool(synthetic_token_estimation),
        "estimator_id": ESTIMATOR_ID,
        "estimator_method_en": ESTIMATOR_METHOD_EN,
        "manifest_relative": "examples/benchmarks/scale/manifest.json",
        "scenarios": full_rows,
        "scale_results": scale_results,
        "summary": {
            "scenario_count": len(full_rows),
            "passed_count": len(ok),
            "failed_count": len(failed),
        },
        "monotonicity": {
            "prompt_tokens_non_decreasing": prompt_non_dec,
            "baseline_code_tokens_non_decreasing": baseline_non_dec,
            "sorted_by_size_rank": [str(s.get("size")) for s in scenarios_in],
        },
        "ratio_stability": ratio_stability,
        "notes": [
            "scale_results are ordered by size_rank (10k → 1m).",
            "Synthetic NL/code: TASK.md + BASELINE_CODE.txt headers on disk, body = repeated _shared units until token floors.",
            "compression_ratio = prompt_tokens / max(1, torqa_tokens).",
            "compression_ratio_combined = (prompt_tokens + baseline_code_tokens) / max(1, torqa_tokens).",
            "reduction_percent = (prompt_tokens - torqa_tokens) / prompt_tokens * 100.",
            "torqa_tokens is nearly constant across tiers (same minimal flow shape); ratios grow with synthetic NL size.",
            "ratio_stability: TORQA surface token count and ir_to_torqa_ratio should be stable; compression ratios should increase monotonically with scale.",
        ],
    }


def report_scale_to_canonical_json(report: Dict[str, Any]) -> str:
    return json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n"

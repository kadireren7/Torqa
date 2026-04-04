"""
P79 — Real tokenizer counts (tiktoken when installed) + illustrative cost model.

Offline only: uses bundled BPE vocab (tiktoken) or falls back to ``utf8_bytes_div_4_v1``.
No network, no API calls.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from src.benchmarks.token_estimate import ESTIMATOR_ID, ESTIMATOR_METHOD_EN, estimate_tokens
from src.benchmarks.token_proof import _load_manifest, measure_scenario

TOKEN_PROOF_REAL_SCHEMA_VERSION = 1
TOKEN_PROOF_REAL_SUITE_ID = "token_proof_real_v1"

# cl100k_base: widely used for GPT-3.5/4-era English+code; deterministic offline tables in tiktoken.
TIKTOKEN_ENCODING_NAME = "cl100k_base"
TIKTOKEN_BACKEND_ID = "tiktoken_cl100k_base"

_enc: Any = None
_backend_id: Optional[str] = None


def _init_tokenizer() -> Tuple[Any, str]:
    """Lazy-init; returns (encoding_or_None, backend_id)."""
    global _enc, _backend_id
    if _backend_id is not None:
        return _enc, _backend_id
    try:
        import tiktoken

        _enc = tiktoken.get_encoding(TIKTOKEN_ENCODING_NAME)
        _backend_id = TIKTOKEN_BACKEND_ID
    except Exception:  # noqa: BLE001 — import or encoding failure → fallback
        _enc = None
        _backend_id = "utf8_bytes_div_4_v1_fallback"
    return _enc, _backend_id


def count_tokens_real(text: str) -> int:
    enc, _ = _init_tokenizer()
    if enc is not None:
        return int(len(enc.encode(text)))
    return int(estimate_tokens(text))


def tokenizer_method_en() -> str:
    _, bid = _init_tokenizer()
    if bid == TIKTOKEN_BACKEND_ID:
        return (
            f"tiktoken.get_encoding({TIKTOKEN_ENCODING_NAME!r}) — BPE token count = len(encoding.encode(text)); "
            "offline bundled tables; no API."
        )
    return f"Fallback: same rule as {ESTIMATOR_ID} — {ESTIMATOR_METHOD_EN}"


# Illustrative USD / 1K tokens for *relative* cost comparison only (not a quote).
DEFAULT_COST_MODEL: Dict[str, Any] = {
    "currency": "USD",
    "input_cost_per_1k": 0.0025,
    "output_cost_per_1k": 0.0100,
    "reference_note_en": (
        "Placeholder rates for spreadsheet-style comparison; replace with your provider list price. "
        "Static benchmark has output_tokens_real=0 so output pricing does not affect headline reduction."
    ),
}


def _round_money(x: float) -> float:
    return round(float(x), 8)


def _round_ratio(x: float) -> float:
    return round(float(x), 6)


def _cost_input(tokens: int, per_1k: float) -> float:
    return _round_money(max(0, tokens) / 1000.0 * float(per_1k))


def _cost_output(tokens: int, per_1k: float) -> float:
    return _round_money(max(0, tokens) / 1000.0 * float(per_1k))


def build_token_proof_real_report(
    repo_root: Path,
    *,
    cost_model: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    repo_root = repo_root.resolve()
    manifest = _load_manifest(repo_root)
    scenarios_in = list(manifest.get("scenarios") or [])
    cm = dict(DEFAULT_COST_MODEL)
    if cost_model:
        cm.update(cost_model)
    in_rate = float(cm["input_cost_per_1k"])
    out_rate = float(cm["output_cost_per_1k"])

    enc, backend = _init_tokenizer()

    rows_out: List[Dict[str, Any]] = []
    d_prompt: List[float] = []
    d_torqa: List[float] = []
    d_base: List[float] = []

    for sc in scenarios_in:
        base_row = measure_scenario(repo_root, sc)
        tc_est = base_row.get("token_counts") or {}
        pe = int(tc_est.get("prompt_tokens") or 0)
        te = int(tc_est.get("torqa_tokens") or 0)
        be = int(tc_est.get("baseline_code_tokens") or 0)

        rel_dir = str(sc["relative_dir"])
        base = (repo_root / rel_dir).resolve()
        if not base_row.get("ok"):
            rows_out.append(
                {
                    "id": base_row.get("id"),
                    "category": base_row.get("category"),
                    "relative_dir": base_row.get("relative_dir"),
                    "ok": False,
                    "errors": base_row.get("errors"),
                    "prompt_tokens_real": None,
                    "torqa_tokens_real": None,
                    "baseline_code_tokens_real": None,
                    "output_tokens_real": None,
                    "total_tokens_real": None,
                    "prompt_cost": None,
                    "torqa_cost": None,
                    "baseline_cost": None,
                    "output_cost": None,
                    "combined_nl_path_cost_real": None,
                    "torqa_path_cost_real": None,
                    "cost_reduction_percent": None,
                    "token_counts_estimator": tc_est,
                },
            )
            continue

        prompt_text = (base / "TASK.md").read_text(encoding="utf-8")
        baseline_text = (base / "BASELINE_CODE.txt").read_text(encoding="utf-8")
        tq_text = (base / "app.tq").read_text(encoding="utf-8")

        pr = count_tokens_real(prompt_text)
        tr = count_tokens_real(tq_text)
        br = count_tokens_real(baseline_text)
        output_r = 0
        total_r = pr + tr + br

        prompt_cost = _cost_input(pr, in_rate)
        torqa_cost = _cost_input(tr, in_rate)
        baseline_cost = _cost_input(br, in_rate)
        output_cost = _cost_output(output_r, out_rate)
        combined_nl = _round_money(prompt_cost + baseline_cost)
        torqa_path = _round_money(torqa_cost)
        red_pct = (
            _round_ratio(100.0 * (combined_nl - torqa_path) / combined_nl) if combined_nl > 0 else None
        )

        d_prompt.append(float(pr - pe))
        d_torqa.append(float(tr - te))
        d_base.append(float(br - be))

        rows_out.append(
            {
                "id": base_row.get("id"),
                "category": base_row.get("category"),
                "relative_dir": base_row.get("relative_dir"),
                "ok": True,
                "errors": [],
                "prompt_tokens_real": pr,
                "torqa_tokens_real": tr,
                "baseline_code_tokens_real": br,
                "output_tokens_real": output_r,
                "total_tokens_real": total_r,
                "prompt_cost": prompt_cost,
                "torqa_cost": torqa_cost,
                "baseline_cost": baseline_cost,
                "output_cost": output_cost,
                "combined_nl_path_cost_real": combined_nl,
                "torqa_path_cost_real": torqa_path,
                "cost_reduction_percent": red_pct,
                "token_counts_estimator": tc_est,
                "compression_ratio_real_prompt_per_torqa": _round_ratio(pr / max(1, tr)),
            },
        )

    ok_rows = [r for r in rows_out if r.get("ok")]
    n_ok = len(ok_rows)
    mean = lambda xs: sum(xs) / len(xs) if xs else None

    estimator_vs_real_diff: Dict[str, Any] = {
        "prompt_mean_delta_tokens": _round_ratio(mean(d_prompt)) if d_prompt else None,
        "torqa_mean_delta_tokens": _round_ratio(mean(d_torqa)) if d_torqa else None,
        "baseline_mean_delta_tokens": _round_ratio(mean(d_base)) if d_base else None,
        "prompt_mean_ratio_real_over_est": None,
        "torqa_mean_ratio_real_over_est": None,
    }
    if ok_rows:
        rp = [r["prompt_tokens_real"] / max(1, r["token_counts_estimator"]["prompt_tokens"]) for r in ok_rows]
        rt = [r["torqa_tokens_real"] / max(1, r["token_counts_estimator"]["torqa_tokens"]) for r in ok_rows]
        estimator_vs_real_diff["prompt_mean_ratio_real_over_est"] = _round_ratio(sum(rp) / len(rp))
        estimator_vs_real_diff["torqa_mean_ratio_real_over_est"] = _round_ratio(sum(rt) / len(rt))

    avg_red = None
    if ok_rows:
        reds = [float(r["cost_reduction_percent"]) for r in ok_rows if r.get("cost_reduction_percent") is not None]
        if reds:
            avg_red = _round_ratio(sum(reds) / len(reds))

    return {
        "schema_version": TOKEN_PROOF_REAL_SCHEMA_VERSION,
        "suite_id": TOKEN_PROOF_REAL_SUITE_ID,
        "offline": True,
        "no_external_api": True,
        "tokenizer_backend_id": backend,
        "tokenizer_encoding": TIKTOKEN_ENCODING_NAME if backend == TIKTOKEN_BACKEND_ID else None,
        "tokenizer_method_en": tokenizer_method_en(),
        "reference_estimator_id": ESTIMATOR_ID,
        "reference_estimator_method_en": ESTIMATOR_METHOD_EN,
        "cost_model": cm,
        "estimator_vs_real_diff": estimator_vs_real_diff,
        "manifest_relative": "examples/benchmarks/token_proof/manifest.json",
        "scenarios": rows_out,
        "summary": {
            "scenario_count": len(rows_out),
            "passed_count": n_ok,
            "failed_count": len(rows_out) - n_ok,
            "average_cost_reduction_percent_vs_torqa_path": avg_red,
        },
        "notes": [
            "output_tokens_real is 0 for this static corpus (no LLM generation measured).",
            "cost_reduction_percent = (combined_nl_path_cost_real - torqa_path_cost_real) / combined_nl_path_cost_real * 100.",
            "combined_nl_path_cost_real prices prompt + baseline as input; torqa_path_cost_real prices .tq surface as input.",
            "When tokenizer_backend_id is utf8_bytes_div_4_v1_fallback, real counts equal the legacy estimator (diff ≈ 0).",
        ],
    }


def report_real_to_canonical_json(report: Dict[str, Any]) -> str:
    return json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n"

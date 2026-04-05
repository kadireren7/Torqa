"""
P136: assemble a single machine-readable launch comparison report from existing
checked-in benchmarks (token proof + flagship compression). No API calls.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPORT_ID = "p136_launch_comparison_v1"
SCHEMA_VERSION = 1

# Aligned with desktop/src/modelCompareReference.ts — illustrative only.
VENDOR_REFERENCE_USD_PER_MTOK = [
    {"vendor": "gpt", "input_usd_per_million": 2.5, "output_usd_per_million": 10.0},
    {"vendor": "claude", "input_usd_per_million": 3.0, "output_usd_per_million": 15.0},
    {"vendor": "gemini", "input_usd_per_million": 1.25, "output_usd_per_million": 5.0},
]

# Map each token-proof scenario id → P136 scenario family (public taxonomy).
TOKEN_PROOF_SCENARIO_FAMILY: dict[str, str] = {
    "simple_form_flow": "workflows",
    "approval_workflow": "workflows",
    "data_transform_pipeline": "automations",
    "conditional_logic_flow": "workflows",
    "multi_step_automation": "automations",
}

FAMILY_DESCRIPTIONS_EN: dict[str, str] = {
    "websites": "NL task vs `.tq` surface for a flagship web UI shell (login + dashboard-shaped benchmark).",
    "apps": "Estimated size of generated webapp output vs `.tq` surface for the same flagship benchmark (artifact footprint, not runtime quality).",
    "workflows": "Curated multi-step business flows (forms, approvals, branching) from the token-proof suite.",
    "automations": "Pipeline- and script-shaped scenarios from the token-proof suite (data transform, multi-step automation).",
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _cost_reference(in_tok: float, out_tok: float, inp_rate: float, out_rate: float) -> float:
    return (in_tok / 1_000_000.0) * inp_rate + (out_tok / 1_000_000.0) * out_rate


def build_comparison_report(repo_root: Path) -> dict[str, Any]:
    repo_root = repo_root.resolve()
    tp_path = repo_root / "reports" / "token_proof.json"
    flagship_path = repo_root / "examples" / "benchmark_flagship" / "compression_baseline_report.json"
    if not tp_path.is_file():
        raise FileNotFoundError(f"Missing {tp_path} (run torqa-token-proof)")
    if not flagship_path.is_file():
        raise FileNotFoundError(f"Missing {flagship_path}")

    tp = _read_json(tp_path)
    flagship = _read_json(flagship_path)
    pub = tp.get("public_summary") if isinstance(tp.get("public_summary"), dict) else {}
    scenarios_in = tp.get("scenarios")
    scenarios_out: list[dict[str, Any]] = []
    if isinstance(scenarios_in, list):
        for s in scenarios_in:
            if not isinstance(s, dict):
                continue
            sid = s.get("id")
            if not isinstance(sid, str):
                continue
            fam = TOKEN_PROOF_SCENARIO_FAMILY.get(sid, "workflows")
            tc = s.get("token_counts") if isinstance(s.get("token_counts"), dict) else {}
            scenarios_out.append(
                {
                    "id": sid,
                    "scenario_family": fam,
                    "category": s.get("category"),
                    "ok": s.get("ok"),
                    "token_counts": {
                        "prompt_tokens": tc.get("prompt_tokens"),
                        "torqa_tokens": tc.get("torqa_tokens"),
                        "baseline_code_tokens": tc.get("baseline_code_tokens"),
                        "ir_tokens": tc.get("ir_tokens"),
                    },
                }
            )

    fm = flagship.get("metrics") if isinstance(flagship.get("metrics"), dict) else {}
    task_tok = fm.get("task_prompt_token_estimate")
    tq_tok = fm.get("torqa_source_token_estimate")
    gen_tok = fm.get("generated_output_token_estimate")
    ir_tok = fm.get("ir_bundle_token_estimate")
    sem_ratio = fm.get("semantic_compression_ratio")

    # Cost rows: reference only, using same synthetic "NL path" = prompt + baseline-style output proxy.
    flagship_cost_examples: list[dict[str, Any]] = []
    if all(isinstance(x, (int, float)) and x == x for x in (task_tok, tq_tok, ir_tok)):  # noqa: PLR2004
        task_f, tq_f, ir_f = float(task_tok), float(tq_tok), float(ir_tok)
        for v in VENDOR_REFERENCE_USD_PER_MTOK:
            inp_r = float(v["input_usd_per_million"])
            out_r = float(v["output_usd_per_million"])
            nl_in, nl_out = task_f, float(gen_tok) if isinstance(gen_tok, (int, float)) else task_f * 3
            tq_in, tq_out = tq_f, ir_f
            flagship_cost_examples.append(
                {
                    "vendor": v["vendor"],
                    "nl_path_usd_estimate": round(_cost_reference(nl_in, nl_out, inp_r, out_r), 6),
                    "torqa_path_usd_estimate": round(_cost_reference(tq_in, tq_out, inp_r, out_r), 6),
                    "note_en": "NL path uses task prompt + generated-output token estimate as a coarse proxy for a code-gen envelope; TORQA path uses `.tq` surface + IR bundle tokens. Illustrative pricing tiers only.",
                }
            )

    family_counts: dict[str, int] = {"websites": 1, "apps": 1, "workflows": 0, "automations": 0}
    for row in scenarios_out:
        fam = row.get("scenario_family")
        if fam in ("workflows", "automations"):
            family_counts[fam] = family_counts.get(fam, 0) + 1

    return {
        "schema_version": SCHEMA_VERSION,
        "report_id": REPORT_ID,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "honesty": {
            "reference_en": (
                "All numbers in this file are computed offline from checked-in fixtures. "
                "Token counts use the repository estimator utf8_bytes_div_4_v1 unless noted. "
                "Vendor USD columns use published-style list tiers as reference math only — not invoices and not live quotes."
            ),
            "live_en": (
                "Live API runs (exact tokenizer usage, retries, success/failure, heuristic quality scores) are not aggregated here. "
                "See TORQA Desktop after generate-tq / app, and CLI JSON for per-run fields."
            ),
        },
        "metric_catalog": [
            {
                "id": "tokens",
                "scope": "reference",
                "definition_en": "Estimated tokens from deterministic UTF-8/4 estimator or flagship report fields.",
            },
            {
                "id": "estimated_cost_usd",
                "scope": "reference",
                "definition_en": "Derived from tokens × illustrative USD/Mtok tables; same tokens for GPT/Claude/Gemini columns, different price tables.",
            },
            {
                "id": "retries",
                "scope": "live",
                "definition_en": "Per-run repair/retry counts from core when using live LLM providers; omitted in reference suite.",
            },
            {
                "id": "success_rate",
                "scope": "live",
                "definition_en": "Whether validation/build stages succeeded for a given run; aggregate separately for trials.",
            },
            {
                "id": "quality_score",
                "scope": "live",
                "definition_en": "Heuristic score from core LLM pipeline metadata when present; not part of token-proof JSON.",
            },
        ],
        "vendor_reference_pricing_usd_per_million_tokens": VENDOR_REFERENCE_USD_PER_MTOK,
        "pricing_note_en": "Verify current list prices with each vendor; tiers change frequently.",
        "scenario_families": {
            k: {"description_en": v}
            for k, v in FAMILY_DESCRIPTIONS_EN.items()
        },
        "family_coverage_counts": family_counts,
        "source_reports": {
            "token_proof_json": "reports/token_proof.json",
            "flagship_compression_json": "examples/benchmark_flagship/compression_baseline_report.json",
        },
        "flagship_reference": {
            "scenario_family_websites": {
                "benchmark_id": flagship.get("benchmark_id"),
                "estimator_id": flagship.get("estimator_id"),
                "task_prompt_token_estimate": task_tok,
                "torqa_source_token_estimate": tq_tok,
                "semantic_compression_ratio": sem_ratio,
                "note_en": "Headline NL-vs-surface compression for the flagship web shell benchmark.",
            },
            "scenario_family_apps": {
                "generated_output_token_estimate": gen_tok,
                "torqa_source_token_estimate": tq_tok,
                "ir_bundle_token_estimate": ir_tok,
                "generated_to_surface_ratio": fm.get("generated_to_surface_ratio"),
                "note_en": "Compares generated webapp token estimate to `.tq` surface size — scope is footprint, not UX quality.",
            },
            "reference_cost_examples": flagship_cost_examples,
        },
        "token_proof_reference": {
            "suite_id": pub.get("suite_id"),
            "passed_scenario_count": pub.get("passed_scenario_count"),
            "scenario_count": pub.get("scenario_count"),
            "average_compression_ratio_prompt_per_torqa": pub.get("average_compression_ratio_prompt_per_torqa"),
            "average_prompt_token_reduction_percent_vs_torqa": pub.get("average_prompt_token_reduction_percent_vs_torqa"),
            "scenarios": scenarios_out,
        },
        "documentation_md": "docs/COMPARISON_REPORT.md",
    }


def report_to_canonical_json(report: dict[str, Any]) -> str:
    return json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

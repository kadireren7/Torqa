"""
P75/P77 — reproducible token comparison: NL task + baseline code vs .tq (and IR).

Uses the same estimator as ``token_estimate`` / ``token_measurement``. No fabricated numbers:
failed validation surfaces are reported with ``ok: false`` and excluded from aggregate averages.

P77 adds a stable ``public_summary`` block for README, website, and desktop copy, plus richer
``docs/TOKEN_PROOF.md`` generation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.benchmarks.token_estimate import ESTIMATOR_ID, ESTIMATOR_METHOD_EN, estimate_tokens
from src.benchmarks.token_measurement import canonical_ir_goal_json
from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.surface.parse_tq import TQParseError, parse_tq_source

# Bump when top-level report shape or semantics change (regression tests pin this).
TOKEN_PROOF_SCHEMA_VERSION = 2
# Stable id for product copy and regression tests (manifest scenarios are workflow-oriented).
TOKEN_PROOF_PUBLIC_SUITE_ID = "token_proof_workflow_v1"


def _round_ratio(num: float) -> float:
    return round(float(num), 6)


def _load_manifest(repo_root: Path) -> Dict[str, Any]:
    p = repo_root / "examples" / "benchmarks" / "token_proof" / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8"))


def measure_scenario(
    repo_root: Path,
    scenario: Dict[str, Any],
    *,
    override_prompt_text: Optional[str] = None,
    override_baseline_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Returns one scenario record: metrics when validation ok, else errors and null metric fields.

    When ``override_prompt_text`` / ``override_baseline_text`` are set, disk TASK.md / BASELINE_CODE.txt
    are not read for token counts (used by scale suite synthetic NL); ``app.tq`` is always read from disk.
    """
    sid = str(scenario["id"])
    rel_dir = str(scenario["relative_dir"])
    category = str(scenario.get("category", sid))
    base = (repo_root / rel_dir).resolve()
    task_path = base / "TASK.md"
    baseline_path = base / "BASELINE_CODE.txt"
    tq_path = base / "app.tq"

    out: Dict[str, Any] = {
        "id": sid,
        "category": category,
        "relative_dir": rel_dir.replace("\\", "/"),
        "ok": False,
        "errors": [],
    }

    missing_paths: List[Path] = []
    if not tq_path.is_file():
        missing_paths.append(tq_path)
    if override_prompt_text is None and not task_path.is_file():
        missing_paths.append(task_path)
    if override_baseline_text is None and not baseline_path.is_file():
        missing_paths.append(baseline_path)

    missing = [str(p.relative_to(repo_root)) for p in missing_paths]
    if missing:
        out["errors"] = [f"missing files: {', '.join(missing)}"]
        return out

    if override_prompt_text is not None:
        prompt_text = override_prompt_text
    else:
        prompt_text = task_path.read_text(encoding="utf-8")
    if override_baseline_text is not None:
        baseline_code_text = override_baseline_text
    else:
        baseline_code_text = baseline_path.read_text(encoding="utf-8")
    tq_text = tq_path.read_text(encoding="utf-8")

    prompt_tokens = estimate_tokens(prompt_text)
    baseline_code_tokens = estimate_tokens(baseline_code_text)
    torqa_tokens = estimate_tokens(tq_text)

    out["sources"] = {
        "task_md": str(task_path.relative_to(repo_root)).replace("\\", "/"),
        "baseline_code": str(baseline_path.relative_to(repo_root)).replace("\\", "/"),
        "app_tq": str(tq_path.relative_to(repo_root)).replace("\\", "/"),
    }
    out["token_counts"] = {
        "prompt_tokens": prompt_tokens,
        "baseline_code_tokens": baseline_code_tokens,
        "torqa_tokens": torqa_tokens,
        "combined_nl_and_code_tokens": prompt_tokens + baseline_code_tokens,
    }

    try:
        bundle = parse_tq_source(tq_text, tq_path=tq_path)
    except TQParseError as ex:
        out["errors"] = [f"TQParseError: {ex.code}: {ex}"]
        out["token_counts"]["ir_tokens"] = None
        out["compression_ratio_prompt_per_torqa"] = None
        return out

    ir_goal = bundle.get("ir_goal")
    if not isinstance(ir_goal, dict):
        out["errors"] = ["bundle missing ir_goal dict"]
        out["token_counts"]["ir_tokens"] = None
        out["compression_ratio_prompt_per_torqa"] = None
        return out

    ir_json = canonical_ir_goal_json(ir_goal)
    ir_tokens = estimate_tokens(ir_json)
    out["token_counts"]["ir_tokens"] = ir_tokens

    try:
        g = ir_goal_from_json(bundle)
        rep = build_full_diagnostic_report(g)
    except Exception as ex:  # noqa: BLE001 — surface unexpected shape as failure
        out["errors"] = [f"ir/diagnostics: {ex}"]
        out["compression_ratio_prompt_per_torqa"] = None
        return out

    if not rep.get("ok", False):
        issues = rep.get("issues") or []
        msgs = [str(i.get("message", i)) for i in issues[:12]]
        out["errors"] = msgs if msgs else ["diagnostics not ok"]
        out["compression_ratio_prompt_per_torqa"] = None
        return out

    out["ok"] = True
    out["compression_ratio_prompt_per_torqa"] = _round_ratio(prompt_tokens / max(1, torqa_tokens))
    out["compression_ratio_combined_per_torqa"] = _round_ratio(
        (prompt_tokens + baseline_code_tokens) / max(1, torqa_tokens),
    )
    out["ir_to_torqa_ratio"] = _round_ratio(ir_tokens / max(1, torqa_tokens))
    return out


def build_token_proof_report(repo_root: Path) -> Dict[str, Any]:
    repo_root = repo_root.resolve()
    manifest = _load_manifest(repo_root)
    scenarios_in = list(manifest.get("scenarios") or [])
    rows: List[Dict[str, Any]] = []
    for sc in scenarios_in:
        rows.append(measure_scenario(repo_root, sc))

    ok_rows = [r for r in rows if r.get("ok")]
    fail_rows = [r for r in rows if not r.get("ok")]

    avg_prompt_per_tq: Optional[float] = None
    avg_combined_per_tq: Optional[float] = None
    avg_reduction_pct: Optional[float] = None
    if ok_rows:
        ratios = [float(r["compression_ratio_prompt_per_torqa"]) for r in ok_rows]
        avg_prompt_per_tq = _round_ratio(sum(ratios) / len(ratios))
        comb = [float(r["compression_ratio_combined_per_torqa"]) for r in ok_rows]
        avg_combined_per_tq = _round_ratio(sum(comb) / len(comb))
        # "Reduction": (torqa - prompt) / prompt is negative when torqa smaller; report (1 - torqa/prompt) as NL→TQ savings
        savings = []
        for r in ok_rows:
            tc = r["token_counts"]
            pt = int(tc["prompt_tokens"])
            tt = int(tc["torqa_tokens"])
            if pt > 0:
                savings.append((pt - tt) / pt)
        if savings:
            avg_reduction_pct = _round_ratio(100.0 * (sum(savings) / len(savings)))

    summary = {
        "scenario_count": len(rows),
        "passed_count": len(ok_rows),
        "failed_count": len(fail_rows),
        "average_compression_ratio_prompt_per_torqa": avg_prompt_per_tq,
        "average_compression_ratio_combined_nl_code_per_torqa": avg_combined_per_tq,
        "average_prompt_token_reduction_percent_vs_torqa": avg_reduction_pct,
    }
    public_summary = _build_public_summary(summary, rows)

    return {
        "schema_version": TOKEN_PROOF_SCHEMA_VERSION,
        "estimator_id": ESTIMATOR_ID,
        "estimator_method_en": ESTIMATOR_METHOD_EN,
        "manifest_relative": "examples/benchmarks/token_proof/manifest.json",
        "scenarios": rows,
        "summary": summary,
        "public_summary": public_summary,
        "notes": [
            "compression_ratio_prompt_per_torqa = prompt_tokens / max(1, torqa_tokens).",
            "compression_ratio_combined_per_torqa = (prompt_tokens + baseline_code_tokens) / max(1, torqa_tokens).",
            "average_prompt_token_reduction_percent_vs_torqa = mean over passing scenarios of (prompt_tokens - torqa_tokens) / prompt_tokens * 100.",
            "baseline_code_tokens: fixed BASELINE_CODE.txt per scenario (approximate non-TORQA implementation).",
            "ir_to_torqa_ratio > 1 means canonical IR JSON is larger than the .tq surface (expected); NL→TQ compression is the headline claim.",
            "Failed scenarios are listed with errors; they are excluded from summary averages.",
        ],
    }


def _build_public_summary(summary: Dict[str, Any], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Product-facing, machine-readable copy block; keep wording measured (P77)."""
    fails = [r for r in rows if not r.get("ok")]
    fail_ids = [str(r.get("id")) for r in fails]
    return {
        "suite_id": TOKEN_PROOF_PUBLIC_SUITE_ID,
        "machine_report_json": "reports/token_proof.json",
        "documentation_md": "docs/TOKEN_PROOF.md",
        "scenario_count": summary["scenario_count"],
        "passed_scenario_count": summary["passed_count"],
        "failed_scenario_count": summary["failed_count"],
        "failed_scenario_ids": fail_ids,
        "average_prompt_token_reduction_percent_vs_torqa": summary["average_prompt_token_reduction_percent_vs_torqa"],
        "average_compression_ratio_prompt_per_torqa": summary["average_compression_ratio_prompt_per_torqa"],
        "measurement_focus_en": (
            "Workflow- and automation-shaped intent: forms, approvals, data pipelines, branching logic, "
            "and small multi-step scripts. Each scenario pairs a fixed NL task (TASK.md), a fixed baseline "
            "code stub (BASELINE_CODE.txt), and a `.tq` surface that must pass the same core parse + diagnostics."
        ),
        "not_the_headline_en": (
            "Generated website or UI bundle size is not the headline for this suite; see the flagship compression "
            "path (`docs/BENCHMARK_COMPRESSION.md`, `torqa-compression-bench`) for that slice."
        ),
        "headline_claim_en": (
            "In this benchmark set, TORQA expressed the same workflow intent with substantially fewer estimated "
            "tokens than the paired natural-language prompts, while the `.tq` surfaces satisfy strict core validation. "
            "Results are scenario-bound and use a deterministic estimator, not live tokenizer APIs."
        ),
    }


def report_to_canonical_json(report: Dict[str, Any]) -> str:
    return json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def render_token_proof_markdown(report: Dict[str, Any]) -> str:
    lines: List[str] = []
    ps = report.get("public_summary") or {}
    summ = report.get("summary") or {}
    lines.append("# TORQA token proof (public benchmark)")
    lines.append("")
    lines.append("**P75/P77** — Reproducible, product-grade comparison of fixed **natural-language task specs** and ")
    lines.append("**baseline code stubs** against **`.tq` surfaces** that must pass **core parse + diagnostics**.")
    lines.append("")
    lines.append("## Product statement (measured, bounded)")
    lines.append("")
    lines.append(f"> {ps.get('headline_claim_en', '')}")
    lines.append("")
    lines.append("This is **not** a claim about general intelligence, arbitrary domains, or exact vendor tokenizers.")
    lines.append("")
    lines.append("## What is being measured")
    lines.append("")
    lines.append("- **Per scenario:** `TASK.md` (NL spec), `BASELINE_CODE.txt` (non-TORQA stub), `app.tq` (TORQA surface).")
    lines.append("- **Token counts:** deterministic estimator on full file text (same rule as `torqa-token-measure` / P32).")
    lines.append("- **Validation gate:** `.tq` is parsed and run through full diagnostics; **failed scenarios stay in the report** ")
    lines.append("  with `ok: false` and are **excluded from aggregate averages** (no hiding — see table and JSON).")
    lines.append("- **Ratios:** prompt÷TORQA and (prompt+baseline code)÷TORQA; optional IR size vs surface per row.")
    lines.append("")
    lines.append(f"- **Estimator:** `{report.get('estimator_id')}`")
    lines.append(f"- **Method:** {report.get('estimator_method_en', '')}")
    lines.append("")
    lines.append("## What is *not* being measured")
    lines.append("")
    lines.append("- **Not** model reasoning quality, runtime behavior, or security of generated apps.")
    lines.append("- **Not** OpenAI/Anthropic exact token counts (no API; no `tiktoken` in this path).")
    lines.append("- **Not** competitive benchmarks against other languages — NL and baseline files are **fixed comparators** in-repo.")
    lines.append("- **Not** universal savings on every prompt; scenarios are **curated workflow-shaped** examples.")
    lines.append("")
    lines.append(ps.get("not_the_headline_en", ""))
    lines.append("")
    lines.append("## Why token reduction matters here")
    lines.append("")
    lines.append(
        "Smaller, validated surfaces lower **context cost** for humans and tools when the intent is the workflow model, "
        "not prose. TORQA keeps **meaning and checks** in the loop: compression is reported **together with** "
        "strict validation, not instead of it.",
    )
    lines.append("")
    lines.append(ps.get("measurement_focus_en", ""))
    lines.append("")
    lines.append("## Benchmark scenarios (manifest-driven)")
    lines.append("")
    lines.append(f"Manifest: `{report.get('manifest_relative')}`. Suite id (stable for copy): `{ps.get('suite_id')}`.")
    lines.append("")
    lines.append("| ID | Category |")
    lines.append("|----|----------|")
    for r in report.get("scenarios") or []:
        lines.append(f"| `{r.get('id')}` | {r.get('category')} |")
    lines.append("")
    lines.append("## Summary (aggregates)")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Scenarios | {summ.get('scenario_count')} |")
    lines.append(f"| Passed validation | {summ.get('passed_count')} |")
    lines.append(f"| Failed | {summ.get('failed_count')} |")
    lines.append(f"| Avg prompt ÷ TORQA tokens | {summ.get('average_compression_ratio_prompt_per_torqa')} |")
    lines.append(f"| Avg (prompt + baseline code) ÷ TORQA | {summ.get('average_compression_ratio_combined_nl_code_per_torqa')} |")
    lines.append(f"| Avg prompt-token reduction % vs `.tq` | {summ.get('average_prompt_token_reduction_percent_vs_torqa')} |")
    lines.append("")
    lines.append("## Estimator limitations")
    lines.append("")
    lines.append(
        "`utf8_bytes_div_4_v1` approximates subword tokenization with **ceil(UTF-8 bytes / 4)** (non-empty). "
        "It is **stable and reproducible** across machines; absolute numbers differ from GPT/claude tokenizers, "
        "but **relative** comparisons within this repo are consistent. Do not treat estimates as invoice-grade.",
    )
    lines.append("")
    lines.append("## Per-scenario metrics")
    lines.append("")
    lines.append("| ID | Category | OK | prompt | baseline code | `.tq` | IR | prompt÷TQ | (prompt+code)÷TQ |")
    lines.append("|----|----------|----|--------|---------------|-------|----|----------|----------------|")
    for r in report.get("scenarios") or []:
        tc = r.get("token_counts") or {}
        ir_t = tc.get("ir_tokens")
        ir_s = "" if ir_t is None else str(ir_t)
        ok = "yes" if r.get("ok") else "no"
        pr = tc.get("prompt_tokens", "")
        bc = tc.get("baseline_code_tokens", "")
        tq = tc.get("torqa_tokens", "")
        c1 = r.get("compression_ratio_prompt_per_torqa", "")
        c2 = r.get("compression_ratio_combined_per_torqa", "")
        lines.append(
            f"| {r.get('id')} | {r.get('category')} | {ok} | {pr} | {bc} | {tq} | {ir_s} | {c1} | {c2} |",
        )
    lines.append("")
    fails = [r for r in (report.get("scenarios") or []) if not r.get("ok")]
    if fails:
        lines.append("## Failures (included in JSON; excluded from averages)")
        lines.append("")
        for r in fails:
            lines.append(f"### `{r.get('id')}`")
            lines.append("")
            for e in r.get("errors") or []:
                lines.append(f"- {e}")
            lines.append("")
    lines.append("## Stable schema & reproduction")
    lines.append("")
    lines.append(f"- **Report schema_version:** `{report.get('schema_version')}`")
    lines.append("- **Canonical JSON:** `reports/token_proof.json` (sorted keys, regenerated by CLI).")
    lines.append("- **Scenario manifest:** `examples/benchmarks/token_proof/manifest.json` (ordered list of `{ id, category, relative_dir }`).")
    lines.append("")
    lines.append("### Regenerate")
    lines.append("")
    lines.append("```bash")
    lines.append("torqa-token-proof")
    lines.append("# or: python -m src.benchmarks.token_proof_cli")
    lines.append("```")
    lines.append("")
    lines.append("### Add a new scenario")
    lines.append("")
    lines.append("1. Create a directory under `examples/benchmarks/<your_id>/` with `TASK.md`, `BASELINE_CODE.txt`, `app.tq`.")
    lines.append("2. Ensure `app.tq` passes core validation (parse + diagnostics).")
    lines.append("3. Append an entry to `examples/benchmarks/token_proof/manifest.json` (`id`, `category`, `relative_dir`).")
    lines.append("4. Run `torqa-token-proof` and commit `reports/token_proof.json`, `docs/TOKEN_PROOF.md`, and tests if ids/counts change.")
    lines.append("")
    lines.append("## Machine-readable `public_summary` (reuse in README / site / desktop)")
    lines.append("")
    lines.append("The JSON report includes a `public_summary` object (suite id, counts, bounded headline text). ")
    lines.append("Prefer reading numbers from `summary` / `public_summary` in `reports/token_proof.json` over hard-coding.")
    lines.append("")
    lines.append("## Field notes (formulas)")
    lines.append("")
    for n in report.get("notes") or []:
        lines.append(f"- {n}")
    lines.append("")
    return "\n".join(lines)

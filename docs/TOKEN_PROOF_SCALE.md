# Token proof at scale (P78)

This suite extends the [token proof](TOKEN_PROOF.md) idea to **large intent-equivalent** natural language and baseline code sizes **without** committing multi‑megabyte files to git.

## What is being simulated

We target **token floors** (10K, 50K, 100K, 500K, 1M) using the same deterministic estimator as the rest of the repo: **`utf8_bytes_div_4_v1`** (`docs/BENCHMARK_COMPRESSION.md`).

**On disk** (per tier under `examples/benchmarks/scale/*_workflow/`):

- **`TASK.md`** — short header describing the tier.
- **`BASELINE_CODE.txt`** — short header for the non-TORQA baseline.
- **`app.tq`** — **minimal** validated TORQA surface; **byte-identical across every tier** (same `module` / intent) so `torqa_tokens` and IR expansion ratios are stable while only synthetic NL/baseline grow.
- **`scale_target.json`** — `target_prompt_tokens_floor`, `target_baseline_tokens_floor`, `synthetic_pattern_version`.

**At report time** (`torqa-token-proof --scale` or `--scale-only`):

- The tool reads shared repeatable units from `examples/benchmarks/scale/_shared/`:
  - `nl_repeat_unit.md` — structured NL “slice” (branching / fields / policy language).
  - `baseline_repeat_unit.txt` — code-shaped slice (handlers, branches, hooks).
- It **concatenates** indexed segments until `estimate_tokens(full_text) >= floor` for both NL and baseline.
- It measures **prompt_tokens**, **baseline_code_tokens**, and **torqa_tokens** from disk **`app.tq`** plus the synthetic bodies.
- Every tier must **pass** the same core **parse + diagnostics** as the small token-proof scenarios (**no skipped failures** in the published report).

So “10K / 1M intent equivalent” means **at least that many estimated tokens** of **structured, repeated specification text**, not a claim that a real human wrote a single 1M-token doc.

## How to reproduce

```bash
torqa-token-proof --scale-only
# or alongside the standard report:
torqa-token-proof --scale
```

Outputs **`reports/token_proof_scale.json`** (canonical, sorted keys).

Flags:

- **`--synthetic-token-estimation`** (default when running scale) — expand NL/baseline from `_shared` units.
- **`--no-synthetic-token-estimation`** — read only the small on-disk headers (tiers will **not** hit the floors; for debugging).

## Interpreting `scale_results`

Each row includes:

| Field | Meaning |
|--------|--------|
| `size` | Tier label (`10k` … `1m`). |
| `prompt_tokens` | Estimated tokens for header + synthetic NL body. |
| `torqa_tokens` | Estimated tokens for `app.tq` (nearly constant across tiers). |
| `baseline_code_tokens` | Estimated tokens for header + synthetic baseline body. |
| `compression_ratio` | `prompt_tokens / torqa_tokens`. |
| `reduction_percent` | `(prompt_tokens - torqa_tokens) / prompt_tokens * 100`. |
| `target_prompt_tokens_floor` | Minimum prompt tokens requested for that tier. |

Rows are sorted by **`size_rank`**. The report includes **`monotonicity`**: prompt and baseline token counts must be **non-decreasing** across tiers (regression guard).

Because **`.tq` size is intentionally flat** (minimal flow), **compression_ratio grows** roughly with synthetic NL size: this illustrates **semantic compression headroom** when the canonical surface stays small while prose/spec bulk grows.

## `ratio_stability` (schema v2+)

The JSON object **`ratio_stability`** summarizes **cross-tier invariants** (regression guards in `torqa-token-proof --scale` / `--scale-only`):

| Field | Meaning |
|--------|--------|
| `torqa_surface_token_stable_across_scale` | `torqa_tokens` identical on every passing tier (same `app.tq` → no drift). |
| `torqa_tokens_spread` | `max(torqa_tokens) − min` (expect **0**). |
| `torqa_tokens_coefficient_of_variation` | Population std / mean of `torqa_tokens` (expect **0** when stable). |
| `compression_ratio_monotonic_non_decreasing` | `prompt_tokens / torqa_tokens` never drops as synthetic NL grows. |
| `combined_compression_ratio_monotonic_non_decreasing` | `(prompt + baseline) / torqa` never drops across tiers. |
| `ir_expansion_ratio_stable_across_scale` | `ir_to_torqa_ratio` unchanged across tiers (same IR shape from the same surface). |
| `compression_ratio_range_across_tiers` | Spread between smallest and largest headline ratio (shows how much “headroom” scales). |

**Interpretation:** *Stability* here means **deterministic, expected scaling** — TORQA-side metrics stay flat while NL/baseline bulk grows; ratios climb in a **monotonic** way. That is the opposite of noisy random drift. See `interpretation_en` in the report for a short English summary.

Each `scale_results` row also includes **`compression_ratio_combined`** and **`ir_to_torqa_ratio`** (aligned with the standard token-proof scenario shape).

## Limitations

- **Not** a real subword tokenizer; ratios are **comparable within the repo**, not invoice-grade for a specific LLM.
- **Synthetic repetition** is **not** diverse linguistic data; it stress-tests **size + structure**, not authoring quality.
- **Same IR shape** across tiers (minimal login-style flow): we are **not** claiming every 1M-token real spec maps to one tiny `.tq` without additional surface or modules.
- **Memory**: generating 1M-token-class strings builds multi‑MB text in RAM for the duration of the run (acceptable for a local benchmark).

## Related

- Checked-in machine report: [`reports/token_proof_scale.json`](../reports/token_proof_scale.json)
- Standard multi-scenario proof: [`TOKEN_PROOF.md`](TOKEN_PROOF.md), `torqa-token-proof` (no flags)

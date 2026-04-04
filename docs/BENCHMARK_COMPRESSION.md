# Token compression benchmark (P32)

## What this measures

This benchmark answers: **how compact is TORQA compared to a natural-language task description**, and **how large is the canonical IR and generated webapp** relative to the `.tq` surface — using **deterministic token estimates**, not live LLM tokenizers.

It supports TORQA’s first core promise (**semantic compression**: same intent, fewer tokens than typical NL→code workflows) in a **repeatable** way inside the repo.

## What this does **not** measure

- **Not** model intelligence, code quality, or correctness of generated JS/TS.
- **Not** exact OpenAI / Anthropic token counts (no API keys, no `tiktoken` in the default path).
- **Not** competitor LLM behavior — the **task prompt** file (`BENCHMARK_TASK.md`) is a **fixed comparator text**, not an executed model trace.

## Estimator

Default **`utf8_bytes_div_4_v1`**:  
`token_estimate = max(1, ceil(utf8_byte_length / 4))` for non-empty strings, `0` for empty.

This is a **rough** stand-in for subword tokenization on English/prose and code. All runs use the same rule so **ratios and ordering are reproducible** across machines.

## Metrics (JSON `metrics` object)

| Field | Meaning |
|-------|---------|
| `task_prompt_token_estimate` | `BENCHMARK_TASK.md` full text |
| `torqa_source_token_estimate` | `app.tq` full text |
| `ir_bundle_token_estimate` | Canonical minified JSON of `ir_goal` only (`sort_keys=True`) |
| `generated_output_token_estimate` | Sum of estimates over listed `generated/webapp/...` files (from fixture paths) |
| `generated_output_measured` | `true` if a materialize root was used |
| `semantic_compression_ratio` | `task_prompt / max(1, torqa_source)` — NL task is this many × larger than `.tq` |
| `surface_to_ir_ratio` | `ir_bundle / max(1, torqa_source)` — IR expansion factor |
| `generated_to_surface_ratio` | `generated / max(1, torqa_source)` if measured, else `null` |

## P75 / P77 multi-scenario token proof (public)

Five fixed **workflow-oriented** scenarios (NL task + baseline code vs `.tq`) with checked-in aggregates and a **`public_summary`** block for product copy:

- **Human doc:** [`TOKEN_PROOF.md`](TOKEN_PROOF.md) — what is / is not measured, estimator limits, reproduction, adding scenarios.
- **Machine report:** [`reports/token_proof.json`](../reports/token_proof.json) — `schema_version` (currently **2**), `summary`, `public_summary`, per-scenario rows (failures included, excluded from averages).
- **Regenerate:** `torqa-token-proof` → updates `reports/token_proof.json` + `docs/TOKEN_PROOF.md`
- **Manifest:** `examples/benchmarks/token_proof/manifest.json`

**Regression tests:** `tests/test_token_proof_p75.py`, `tests/test_token_proof_p77_regression.py` pin scenario ids, passing counts, top-level JSON shape, and that the checked-in JSON matches a live build.

## P78 scale token proof (synthetic large intent)

- **Doc:** [`TOKEN_PROOF_SCALE.md`](TOKEN_PROOF_SCALE.md) — how tiers 10K→1M are simulated without huge on-disk blobs.
- **Report:** `torqa-token-proof --scale` or `--scale-only` → [`reports/token_proof_scale.json`](../reports/token_proof_scale.json)
- **Tests:** `tests/test_token_proof_scale.py`

## P79 real tokenizer + cost (offline)

- **Doc:** [`TOKEN_PROOF_REAL.md`](TOKEN_PROOF_REAL.md) — tiktoken `cl100k_base` vs UTF-8÷4 estimator, illustrative USD costs.
- **Report:** `torqa-token-proof-real` → [`reports/token_proof_real.json`](../reports/token_proof_real.json)
- **Tests:** `tests/test_token_proof_real.py` (dev extra includes `tiktoken`)

## Running

From repository root, after `pip install -e .`:

**Canonical measurement JSON** (field names `prompt_tokens`, `torqa_tokens`, `ir_tokens`, `generated_code_tokens`, `semantic_compression_ratio`, … — same estimator, deterministic):

```bash
torqa-token-measure benchmark-dir examples/benchmark_flagship --repo-root .
```

**P32 compression report** (legacy metric names in `metrics` — built from the same core):

```bash
torqa-compression-bench examples/benchmark_flagship --repo-root . \
  --write examples/benchmark_flagship/compression_baseline_report.json
```

Or without installing the entry point:

```bash
python scripts/run_compression_benchmark.py examples/benchmark_flagship --repo-root . \
  --write examples/benchmark_flagship/compression_baseline_report.json
```

- Omit `--write` to print JSON only.
- `--no-generated` — surface + IR only (no materialize).
- `--materialize-root PATH` — use an existing `torqa build` output tree instead of a temp dir.

## Tests

`tests/test_compression_benchmark_p32.py` checks the utility, stable schema, and deterministic ratios for the flagship demo.

## Baseline file

**`examples/benchmark_flagship/compression_baseline_report.json`** — checked-in **first** report (regenerate after changing `BENCHMARK_TASK.md`, `app.tq`, or projection outputs for listed paths).

## Related

- [BENCHMARK_FLAGSHIP.md](BENCHMARK_FLAGSHIP.md) — P31 canonical demo
- [TORQA_DOMINANCE.md](TORQA_DOMINANCE.md) — architecture snapshot

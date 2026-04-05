# P136 — Launch comparison suite (TORQA vs GPT-, Claude-, Gemini-style paths)

**Purpose:** A single, **honest** story for public-facing comparisons: what we measure, what is **reference-only** vs **live**, and where the machine-readable bundle lives.

## Scenario families (standard taxonomy)

| Family | What it represents in this repo | Primary source |
|--------|----------------------------------|----------------|
| **Websites** | NL task vs `.tq` surface for a **flagship web shell** (login + dashboard-shaped benchmark). | `examples/benchmark_flagship/compression_baseline_report.json` |
| **Apps** | **Generated webapp output** token estimate vs `.tq` surface / IR for that same flagship run — **footprint**, not UX or security quality. | Same flagship report (`generated_output_token_estimate`, etc.) |
| **Workflows** | Curated **multi-step business** shapes: forms, approvals, branching logic. | `reports/token_proof.json` scenarios tagged `workflows` in `comparison_report.json` |
| **Automations** | **Pipeline / script-shaped** intents (data transform, multi-step automation). | Token-proof scenarios tagged `automations` |

The token-proof suite is **workflow- and automation-biased** by design; it is **not** a random sample of all software. See [`TOKEN_PROOF.md`](TOKEN_PROOF.md) for scope limits.

## Metrics (standard dictionary)

| Metric | Reference suite | Live runs |
|--------|-----------------|-----------|
| **Tokens** | Yes — deterministic estimator `utf8_bytes_div_4_v1` (and flagship fields). | Exact counts come from vendor APIs when you call them; not rolled into this JSON. |
| **Estimated cost (USD)** | Yes — **illustrative** only: tokens × published-style **list-tier** USD/Mtok tables (GPT / Claude / Gemini columns use **different** price tables on the **same** token totals). | Use provider billing; not aggregated here. |
| **Retries** | Not in reference JSON (offline fixtures). | Exposed in **TORQA Desktop** / CLI JSON for `generate-tq` / `app` when LLM repair loops run. |
| **Success rate** | Per-scenario `ok` in token proof + gate proofs elsewhere. | Per-run pipeline success in desktop/CLI. |
| **Quality score** | Not in token-proof path. | Heuristic fields from core LLM metadata when present (desktop summary). |

## Reference vs live (must not be conflated)

- **Reference estimates** — Precomputed from **checked-in** `TASK.md` / `BASELINE_CODE.txt` / `app.tq` / flagship artifacts. **No network**. Labels in UI: **“Reference”** / **“Offline”**.
- **Live API results** — Anything from a real OpenAI / Anthropic / Google call (tokenizer usage, latency, billing). Labels: **“Live”**. The desktop **Models** comparison table remains reference unless you build a separate live harness.

This split is mirrored in [`reports/comparison_report.json`](../reports/comparison_report.json) under `honesty` and `metric_catalog[].scope`.

## Machine-readable report

- **Canonical:** [`reports/comparison_report.json`](../reports/comparison_report.json)  
- **Website static copy:** [`website/static/shared/comparison_report.json`](../website/static/shared/comparison_report.json) (same content; served at `/static/shared/comparison_report.json` from `torqa-console`)

**Regenerate** (after updating token proof or flagship compression inputs):

```bash
torqa-comparison-report
# or: python -m src.benchmarks.comparison_report_cli
```

Typical maintainer order when benchmarks change:

1. `torqa-token-proof` (updates `reports/token_proof.json`)
2. Refresh flagship compression JSON if the benchmark changed
3. `torqa-comparison-report`

## JSON Schema

See [`spec/comparison_report.schema.json`](../spec/comparison_report.schema.json) (`schema_version` field inside the document is authoritative for consumers).

## Surfaces

| Surface | Role |
|---------|------|
| **This doc** | Narrative + tables + reproduction |
| **JSON** | Dashboards, site widgets, CI checks |
| **Website** | Proof (and related) page loads the static JSON for a short summary block |
| **TORQA Desktop** | **Models** tab: reference table from `reports/token_proof.json` + **P136** summary strip from `reports/comparison_report.json` when the repo is open |

## Related

- [`TOKEN_PROOF.md`](TOKEN_PROOF.md) — token-proof methodology  
- [`BENCHMARK_FLAGSHIP.md`](BENCHMARK_FLAGSHIP.md) — flagship compression  
- [`EXECUTION_LAYER_PROOF.md`](EXECUTION_LAYER_PROOF.md) — broader execution-layer narrative  
- Desktop reference pricing source of truth (TypeScript): `desktop/src/modelCompareReference.ts` (keep in sync with `comparison_report_build.py` vendor table)

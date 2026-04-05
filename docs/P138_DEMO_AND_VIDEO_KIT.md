# P138 — Public demo assets & video-ready proof kit

**Purpose:** Ship a **single entry point** for demos, recordings, social posts, and launch collateral. Technical contracts stay in existing docs; the kit **bundles** prompts, scripts, diagrams, and portable JSON snapshots.

---

## Where everything lives

| Deliverable | Location |
|-------------|----------|
| **Demo kit index** | [`examples/demo_kit/README.md`](../examples/demo_kit/README.md) |
| **Flagship prompts** | [`examples/demo_kit/FLAGSHIP_PROMPTS.md`](../examples/demo_kit/FLAGSHIP_PROMPTS.md) |
| **Video script (desktop)** | [`examples/demo_kit/VIDEO_SCRIPT.md`](../examples/demo_kit/VIDEO_SCRIPT.md) |
| **Canonical proof narrative** | [`examples/demo_kit/PROOF_NARRATIVE.md`](../examples/demo_kit/PROOF_NARRATIVE.md) |
| **SVG assets + snapshots** | [`examples/demo_kit/assets/`](../examples/demo_kit/assets/) |
| **Refresh snapshots** | `python scripts/sync_demo_kit_assets.py` |

---

## Maintainer workflow (after benchmark changes)

1. `torqa-token-proof` → updates `reports/token_proof.json`  
2. Refresh flagship compression JSON if the benchmark changed (`torqa-compression-bench` per [`BENCHMARK_COMPRESSION.md`](BENCHMARK_COMPRESSION.md))  
3. `torqa-comparison-report` → updates `reports/comparison_report.json` and [`website/static/shared/comparison_report.json`](../website/static/shared/comparison_report.json)  
4. `python scripts/sync_demo_kit_assets.py` → refreshes [`examples/demo_kit/assets/snapshots/`](../examples/demo_kit/assets/snapshots/)  

---

## Honesty rules for public use

- **Reference** metrics (token proof, comparison JSON, desktop **Models** table) are **offline / illustrative** where documented — not live invoices.  
- **Live** runs (prompt → generate) show **per-run** telemetry; do not imply global success rates unless you have aggregate study data.  
- Prefer wording from **`public_summary.headline_claim_en`** in token proof and from **`honesty`** in `comparison_report.json`.

---

## Related

- [`TRY_TORQA.md`](TRY_TORQA.md) — official surfaces and canonical trial path  
- [`COMPARISON_REPORT.md`](COMPARISON_REPORT.md) — P136 methodology  
- [`TOKEN_PROOF.md`](TOKEN_PROOF.md) — token-proof suite  
- [`DEMO_SURFACES.md`](DEMO_SURFACES.md) — what to demo on web vs desktop  

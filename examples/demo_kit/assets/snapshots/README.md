# Portable JSON snapshots

Regenerate from repo root:

```bash
python scripts/sync_demo_kit_assets.py
```

| File | Contents |
|------|----------|
| `token_proof_public_summary.json` | `reports/token_proof.json` → `public_summary` |
| `comparison_launch_excerpt.json` | Selected keys from `reports/comparison_report.json` (families, token proof ref, flagship web metrics, honesty) |
| `flagship_compression_metrics.json` | `compression_baseline_report.json` → `metrics` (+ ids) |
| `expected_output_summary.json` | Copy of `examples/benchmark_flagship/expected_output_summary.json` |
| `SYNC_META.json` | Provenance notes |

**Do not hand-edit** for presentations — refresh from sources after benchmark updates.

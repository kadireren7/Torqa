# TORQA demo & launch kit (P138)

**Purpose:** One folder for **demos, screen recordings, posts, and investor decks** — prompts, proof numbers, video flow, and asset specs. Canonical technical truth stays in linked reports; this kit **packages** what presenters need.

---

## Contents

| Item | Role |
|------|------|
| [`FLAGSHIP_PROMPTS.md`](FLAGSHIP_PROMPTS.md) | Stable NL comparator prompt + pointers to `app.tq` and build output |
| [`VIDEO_SCRIPT.md`](VIDEO_SCRIPT.md) | Scene-by-scene **desktop** flow: prompt → build → preview → proof → comparison |
| [`PROOF_NARRATIVE.md`](PROOF_NARRATIVE.md) | **One canonical story:** what TORQA is, why it matters, what is proven today |
| [`assets/`](assets/) | Diagrams, snapshot JSON, screenshot capture checklist |

**Hub doc (repo docs):** [`docs/P138_DEMO_AND_VIDEO_KIT.md`](../../docs/P138_DEMO_AND_VIDEO_KIT.md)

---

## Portable proof snapshots (JSON)

Regenerate after `torqa-token-proof`, flagship compression, or `torqa-comparison-report` changes:

```bash
python scripts/sync_demo_kit_assets.py
```

Output: [`assets/snapshots/`](assets/snapshots/) — `token_proof_public_summary.json`, `comparison_launch_excerpt.json`, `flagship_compression_metrics.json`, `expected_output_summary.json`.

**Source of truth** remains `reports/token_proof.json`, `reports/comparison_report.json`, and `examples/benchmark_flagship/`. Snapshots are for **slides, captions, and offline bundles** without parsing full reports.

---

## Quick repro (flagship build + preview)

```bash
pip install -e .
torqa build examples/benchmark_flagship/app.tq
# Preview: generated_out/generated/webapp → npm install && npm run dev
```

See [`docs/DEMO_LOCALHOST.md`](../../docs/DEMO_LOCALHOST.md) and [`docs/FLAGSHIP_DEMO.md`](../../docs/FLAGSHIP_DEMO.md).

---

## Surfaces to show on camera

| Surface | Launch | Proof on screen |
|---------|--------|-----------------|
| **TORQA Desktop** | `torqa-desktop` (from `desktop/` after `npm install`) | Folder, prompt strip, build, embedded Vite preview, Activity / diagnostics, **Models** + comparison summary |
| **Marketing site** | `torqa-console` or `python -m website.server` → `/` | Hero + comparison summary widget (`/static/shared/comparison_report.json`) |
| **CLI** | `torqa --json app` / `torqa build` | JSON `ok`, `written`, `reliability` / pipeline stages |

Official surface rules: [`docs/TRY_TORQA.md`](../../docs/TRY_TORQA.md).

---

## Related

- [`docs/COMPARISON_REPORT.md`](../../docs/COMPARISON_REPORT.md) — P136 methodology  
- [`docs/TOKEN_PROOF.md`](../../docs/TOKEN_PROOF.md) — token-proof suite  
- [`docs/DEMO_SURFACES.md`](../../docs/DEMO_SURFACES.md) — what to demo where  

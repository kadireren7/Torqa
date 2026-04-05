# Canonical proof narrative (P138)

**Use this block** for landing copy, video intros, one-pagers, and press — then point detail readers to [`docs/COMPARISON_REPORT.md`](../../docs/COMPARISON_REPORT.md), [`docs/TOKEN_PROOF.md`](../../docs/TOKEN_PROOF.md), and [`docs/TRY_TORQA.md`](../../docs/TRY_TORQA.md).

---

## What TORQA is

TORQA is a **compression-first execution layer** for software intent. You express what the system should do — in natural language or in a compact **`.tq` surface`** — and the **core** validates that intent into canonical **IR**, then **projects** it into real artifacts (for example a **Vite + React** webapp shell, SQL, and stubs). The **spec and diagnostics are the contract**; generated files are **outputs**, not promises of production completeness.

---

## Why it matters

Most “AI codegen” stops at text that *looks* like code. TORQA optimizes for **checkable intent**: smaller, reviewable surfaces, **hard validation gates**, and **measured** NL-vs-surface compression on **fixed benchmarks** — so teams can argue about **evidence** (tokens, stages, pass/fail) instead of vibes. That matters for **trust**, **reviews**, and **repeatable demos**.

---

## What it proves today (honest scope)

1. **Flagship path** — A concrete login + dashboard-shaped benchmark (`examples/benchmark_flagship/`) compiles through parse → IR → materialize → local preview; compression metrics are recorded in **`compression_baseline_report.json`** and summarized in **`reports/comparison_report.json`**.  
2. **Token-proof suite** — Multiple workflow- and automation-shaped scenarios show **estimated** NL + baseline code vs `.tq` token counts with a **deterministic estimator** (`reports/token_proof.json`); see **`public_summary.headline_claim_en`** for the exact claim wording.  
3. **Validation gate** — Invalid bundles are **rejected** at defined stages; gate proofs and stress cases are documented under **`docs/VALIDATION_GATE.md`** and related tools.  
4. **Live LLM path** — Desktop and CLI can run **prompt → `.tq` → build** with **per-run** telemetry (retries, quality hints, reliability flags); that is **not** the same as the offline reference tables — we **label** reference vs live everywhere that matters.

**What we do not claim:** arbitrary “build any product from one sentence,” hosted SaaS, or pixel-perfect parity with hand-crafted design systems. Boundaries: [`docs/KNOWN_LIMITS.md`](../../docs/KNOWN_LIMITS.md).

---

## One-paragraph elevator

TORQA is a validated intent layer: compact `.tq` surfaces (or NL-assisted generation) compile to canonical IR and project to real project trees, with hard gates and benchmarked compression so you can **show the math** and **show the preview** — reference metrics in the repo, live runs on your machine.

---

## Portable numbers for captions

Regenerate snapshots after benchmark updates:

```bash
python scripts/sync_demo_kit_assets.py
```

Then read **`assets/snapshots/token_proof_public_summary.json`** and **`assets/snapshots/comparison_launch_excerpt.json`** for slide-ready fields (ratios, scenario counts, honesty strings).

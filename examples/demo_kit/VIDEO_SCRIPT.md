# Video flow script — TORQA Desktop (P138)

**Target length:** 2–4 minutes (tight) or 5–7 minutes (with proof panels).  
**Aspect ratio:** 1920×1080 recommended.  
**Prereqs:** Repo installed (`pip install -e .`), `desktop/` with `npm install`, API keys set if you show **live** generate (optional — you can open a pre-built `.tq` instead).

---

## Before recording

1. Open **repository root** in Desktop (so `reports/token_proof.json` and `reports/comparison_report.json` load in **Models**).  
2. Clear or hide unrelated personal paths; use a neutral workspace folder name (e.g. `torqa-demo-ws`).  
3. Optional: dark OS theme to match Desktop default.  
4. Close notification apps; zoom **100%** or **125%** for legible captions.

---

## Scene A — Cold open (0:00–0:20)

| Shot | Action | Narration cue |
|------|--------|----------------|
| A1 | Title card or logo + tagline | “TORQA turns intent into a validated spec and real project output — here is the desktop flow.” |
| A2 | Desktop **home** — **Choose folder** | “I pick a workspace folder; TORQA stays scoped to it.” |

**On-screen text:** `TORQA Desktop · workspace-scoped`

---

## Scene B — Prompt → spec (0:20–1:10)

| Shot | Action | Narration cue |
|------|--------|----------------|
| B1 | Switch to **Prompt** mode if needed; paste short prompt from [`FLAGSHIP_PROMPTS.md`](FLAGSHIP_PROMPTS.md) | “I describe the product intent in plain language…” |
| B2 | Run **Build from prompt** / app pipeline; show **Activity** or bottom panel progressing | “…the core generates a `.tq` surface, validates it, and materializes a project.” |
| B3 | Editor shows generated `.tq`; optional: **IR** tab | “The compact surface is the contract; IR is the canonical shape the core checks.” |

**On-screen text:** `NL → .tq → validate → IR`

---

## Scene C — Build & preview (1:10–2:00)

| Shot | Action | Narration cue |
|------|--------|----------------|
| C1 | **Build** on the same file if needed; show **Output** / success banner | “Build writes a real Vite + React tree under the workspace.” |
| C2 | **Embedded preview** (or external browser on localhost) | “Preview runs locally — no hosted demo required for the story.” |
| C3 | Pan login / dashboard sections | “Same benchmark intent: overview, sign-in, post-sign-in shell.” |

**On-screen text:** `Materialize · npm run dev · local only`

---

## Scene D — Proof panel (2:00–2:45)

| Shot | Action | Narration cue |
|------|--------|----------------|
| D1 | **Activity** / **Diagnostics** / trial log lines showing token hint or quality | “Each run can surface token estimates and repair telemetry — reference compressions are in our reports.” |
| D2 | Optional: CLI `torqa --json app` in terminal split | “The CLI returns the same JSON shape for automation.” |

**On-screen text:** `Per-run telemetry · not a global success-rate claim`

---

## Scene E — Comparison panel (2:45–3:30)

| Shot | Action | Narration cue |
|------|--------|----------------|
| E1 | **Right sidebar → Models**; reference comparison table | “Offline reference math: same intent expressed as NL + codegen envelope vs TORQA surface + IR — illustrative pricing only.” |
| E2 | Scroll to **P136 comparison summary** (family counts, flagship ratio line) | “We separate reference benchmarks from live API billing.” |

**On-screen text:** `Reference ≠ live invoices`  
**Caption file:** [`assets/snapshots/comparison_launch_excerpt.json`](assets/snapshots/comparison_launch_excerpt.json)

---

## Scene F — Close (3:30–end)

| Shot | Action | Narration cue |
|------|--------|----------------|
| F1 | Static frame: repo path `examples/demo_kit` or docs link | “Full prompts, proof snapshots, and the honest scope live in the open repo.” |

**End card:** `torqa.dev` / GitHub / `docs/P138_DEMO_AND_VIDEO_KIT.md`

---

## B-roll checklist

Capture short loops (5–10 s) for editing: typing prompt, spinner, tree refresh, browser refresh, sidebar tab change, scroll comparison table.

---

## Related

- Screenshot file naming: [`assets/screenshots/CAPTURE_CHECKLIST.md`](assets/screenshots/CAPTURE_CHECKLIST.md)  
- Diagram overlay: [`assets/flow-desktop-proof.svg`](assets/flow-desktop-proof.svg)  

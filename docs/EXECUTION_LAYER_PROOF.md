# TORQA as a compression-first execution layer — proof charter

**Positioning (one line):**

> **TORQA is not another AI tool — it is a compression-first execution layer:** the same natural-language intent is held in a small validated `.tq` surface, checked by deterministic rules, then materialized into real artifacts (web app, bundles, stubs) on one core.

This document maps **product goals** to **shipped artifacts** so teams can **try**, **see the difference**, and **repeat** the demo.

**Official surfaces + canonical trial order:** [TRY_TORQA.md](TRY_TORQA.md).

---

## 1. Product — prompt → app → preview (stable)

| Path | What to run | Stable output |
|------|-------------|----------------|
| **Desktop** | Folder + **Build from prompt** (prompt mode) | Valid `.tq` on disk → materialize → embedded / browser Vite preview when Node is available |
| **CLI** | `torqa --json app --workspace <dir> --prompt-stdin` (stdin = prompt) | JSON with `stages`, `written`, `local_webapp` |
| **Script** | `torqa-prompt-preview` or `python scripts/prompt_build_preview.py` | `token_preview_overlay.html` + optional `npm run dev` |

**Stability expectations:** parse + diagnostics gate before materialize; failures are structured (JSON + Desktop Activity). Preview depends on Node/npm for Vite — see [`docs/DEMO_LOCALHOST.md`](DEMO_LOCALHOST.md).

---

## 2. Proof — token reduction and cost reduction (verified)

### Token reduction (deterministic, repo-native)

- **Workflow token proof:** `torqa-token-proof` → [`docs/TOKEN_PROOF.md`](TOKEN_PROOF.md), [`reports/token_proof.json`](../reports/token_proof.json) (`public_summary`).
- **Scale / ratio stability:** `torqa-token-proof --scale-only` → [`docs/TOKEN_PROOF_SCALE.md`](TOKEN_PROOF_SCALE.md), [`reports/token_proof_scale.json`](../reports/token_proof_scale.json) (`ratio_stability`).
- **Flagship compression:** `torqa-compression-bench` / flagship demo — [`docs/BENCHMARK_COMPRESSION.md`](BENCHMARK_COMPRESSION.md).

*Estimator is consistent in-repo; not invoice-grade for a specific vendor tokenizer.*

### Cost reduction (OpenAI path, when `OPENAI_API_KEY` is set)

- **Desktop / JSON:** `stages.generate.api_metrics` — HTTP call count, retries, **latency**, **usage** (prompt/completion tokens), **estimated_cost_usd** (bundled or `TORQA_OPENAI_*_PER_MTOK_USD` overrides). See `src/ai/openai_metrics.py`.

*Cost is approximate; compare runs with the same model and prompt to see relative spend on generation passes.*

---

## 3. Comparison — GPT vs TORQA, Claude vs TORQA, Gemini vs TORQA

**Framing (honest):** We do **not** run three separate vendor APIs in one click for marketing. We compare **the same NL task you would give any assistant** against the **TORQA surface and pipeline** produced in one run.

| Assistant ecosystem | What users compare | TORQA execution layer |
|---------------------|-------------------|------------------------|
| **GPT** (ChatGPT, OpenAI API) | Long NL prompt, stochastic replies | Validated `.tq` + deterministic gate + materialize + token/cost metrics on the OpenAI generation path |
| **Claude** (Claude, Claude Code) | Same NL brief in IDE / chat | Same pipeline: NL is the input column; TORQA is what passes parse + diagnostics |
| **Gemini** (AI Studio, Android, Vertex-style) | Same NL at scale | Same: TORQA holds the compact, checkable spec |

**UI copy:** Desktop and website use this **parallel framing** so visitors see one mental model: **assistants generate ideas in NL; TORQA executes intent through a compressed, validated spec.**

---

## 4. Demo — video + live

| Demo | Status / how |
|------|----------------|
| **Live (browser)** | `torqa-console` → marketing site **`#try`** — optional API prompt → token + illustrative `.tq` (no API key when API unavailable). |
| **Live (full pipeline)** | Desktop **Build from prompt** + optional **Generate .tq** (needs `OPENAI_API_KEY` for LLM step). |
| **Script overlay** | `torqa-prompt-preview` — HTML overlay with token bars over iframe preview. |
| **Recorded video** | *Definition of done:* publish a short screen recording (Desktop: prompt → success → preview; optional voiceover reading the positioning line). Place embed URL in [`website/src/App.tsx`](../website/src/App.tsx) `#product-video` when ready. |

---

## 5. Narrative — repeatability

- **Website:** Sections `#hero`, `#quickstart`, `#try`, `#why`, `#proof`, `#desktop` (marketing site at **`/`** only; **`/console` → `/`**).
- **README:** Links here + [`TRY_TORQA.md`](TRY_TORQA.md) + trial readiness.
- **Desktop:** Success card explains **assistant NL (multi-vendor)** vs **TORQA deterministic pass**.

---

## Definition of done (insanlar deneyebiliyor, farkı anlıyor, tekrar etmek istiyor)

- [ ] **Try:** A new visitor can use the site **`#try`** demo (local server) *or* open Desktop and **Build from prompt** without reading the whole repo ([`TRY_TORQA.md`](TRY_TORQA.md)).
- [ ] **Understand:** They see **token / size** difference and read **execution layer vs chat** in one screen (website or Desktop success card).
- [ ] **Repeat:** One command or one button reliably reproduces the happy path (`torqa demo`, `torqa-prompt-preview`, or Desktop prompt mode).
- [ ] **Proof:** At least one maintainer can point to **token_proof.json** (and optional **api_metrics**) for numbers.
- [ ] **Video:** Recorded walkthrough linked from the site or README when published.

---

## Related docs

- [`docs/TRY_TORQA.md`](TRY_TORQA.md) · [`docs/TRIAL_READINESS.md`](TRIAL_READINESS.md) · [`docs/PROOF_SUMMARY.md`](PROOF_SUMMARY.md) · [`docs/P72_WEBSITE_OFFICIAL.md`](P72_WEBSITE_OFFICIAL.md)

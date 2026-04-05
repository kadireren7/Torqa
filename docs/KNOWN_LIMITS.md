# Known limits (product honesty)

**Purpose:** A single place for **scope boundaries** so docs and demos are not over-interpreted. For CLI/runtime failure taxonomy, see [`FAILURE_MODES.md`](FAILURE_MODES.md).

---

## Trial and generated UI

- **First-trial web UI** from projections is a **credible preview shell** (layout, copy, flow structure) — not a full design system, production auth, or CMS ([`TRIAL_READINESS.md`](TRIAL_READINESS.md)).
- **General “any website in one prompt”** is **not** the claim; strongest demos are **flow-shaped** (forms, steps, guards) ([`FLAGSHIP_DEMO.md`](FLAGSHIP_DEMO.md)).
- **Embedded / local preview** often needs **Node.js** for Vite workflows ([`DEMO_LOCALHOST.md`](DEMO_LOCALHOST.md), [`desktop/README.md`](../desktop/README.md)).

---

## AI and generation

- **LLM-assisted** `generate-tq` / `torqa app` depend on **provider API keys** and network; output is **repaired and quality-gated** in-core but **not guaranteed** perfect on first try ([`EXECUTION_LAYER_PROOF.md`](EXECUTION_LAYER_PROOF.md)).
- **Cost and token displays** in tooling are **illustrative** for many providers; OpenAI-style cost fields are the most complete in-repo; see desktop/API metrics notes ([`TOKEN_PROOF_REAL.md`](TOKEN_PROOF_REAL.md)).

---

## Token and compression claims

- **Workflow token proof** ([`TOKEN_PROOF.md`](TOKEN_PROOF.md)): fixed scenarios, **deterministic utf8÷4-style estimator** — stable and comparable in-repo, **not** invoice-grade for every vendor tokenizer.
- **`TOKEN_PROOF_REAL`**: optional **tiktoken** path for closer OpenAI-style counts — still **offline**, still **scenario-bound** ([`TOKEN_PROOF_REAL.md`](TOKEN_PROOF_REAL.md)).
- **Averages exclude failing scenarios** in the standard report; failed rows remain visible in JSON — read the report, not headlines alone.

---

## Hosting and security

- **Not a hosted SaaS** in this repo: you run CLI, desktop, and local web yourself.
- **Do not expose** `torqa-console` or dev servers to the public internet without hardening ([`WEBUI_SECURITY.md`](WEBUI_SECURITY.md), [`PROTOTYPE_SECURITY.md`](PROTOTYPE_SECURITY.md)).

---

## Surfaces

- **Official web UI for authoring is not in the browser:** use **TORQA Desktop** (`torqa-desktop`). The website at **`/`** is **marketing + proof**, not an IDE ([`P73_PRODUCT_SURFACES.md`](P73_PRODUCT_SURFACES.md), [`UI_SURFACE_RULES.md`](UI_SURFACE_RULES.md)).
- **`/console`** does not host tools — it **redirects to `/`**.
- **Windows installer (P133)** ships the **Electron shell only**; it does **not** bundle Python or the `torqa` package — users still need `pip install -e .` from a checkout ([`P133_DESKTOP_DISTRIBUTION.md`](P133_DESKTOP_DISTRIBUTION.md)).

---

## Maturity

- **Early usable, developer-focused:** solid CLI, IR, tests, examples; not a shrink-wrapped consumer product ([`../README.md`](../README.md), [`../STATUS.md`](../STATUS.md)).

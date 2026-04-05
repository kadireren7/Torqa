# TORQA

**Semantic-first core for describing system behavior** — canonical IR, validation, and projections (web, SQL, stubs) so humans and tools share one structured model. **One-sentence product story:** TORQA is a **compression-first execution layer** — NL or `.tq` → **validated spec (IR)** → **materialized artifacts**; see **[`docs/WHAT_TORQA_DOES_BEST.md`](docs/WHAT_TORQA_DOES_BEST.md)** and **[`docs/EXECUTION_LAYER_PROOF.md`](docs/EXECUTION_LAYER_PROOF.md)**. **Start here:** **[`docs/TRY_TORQA.md`](docs/TRY_TORQA.md)** (official surfaces + canonical trial path). **Trial contract & limits:** [`docs/TRIAL_READINESS.md`](docs/TRIAL_READINESS.md) · [`docs/KNOWN_LIMITS.md`](docs/KNOWN_LIMITS.md). Not “another syntax-first language”; **meaning and checks come first**.

---

## Status (read this first)

| | |
|--|--|
| **Maturity** | **Early usable**, **developer-focused** — solid CLI, IR `1.4`, tests, and examples; not a shrink-wrapped product. |
| **Try TORQA (P132)** | **[`docs/TRY_TORQA.md`](docs/TRY_TORQA.md)** — one page: official CLI / website / desktop, canonical flagship trial, prompt pipeline pointers. |
| **First trials (P37)** | **[`docs/TRIAL_READINESS.md`](docs/TRIAL_READINESS.md)** — flagship path, compression + gate proof, generated web preview; explicit limits (see also [`docs/KNOWN_LIMITS.md`](docs/KNOWN_LIMITS.md)). |
| **Execution layer proof** | **[`docs/EXECUTION_LAYER_PROOF.md`](docs/EXECUTION_LAYER_PROOF.md)** — prompt → app → preview, token/cost proof, GPT · Claude · Gemini vs TORQA framing, demo + video checklist. |
| **Best for** | Teams and builders who want **validated specs + codegen**, AI-assisted or not. |
| **Product story** | Deeper direction: [`docs/TORQA_VISION_NORTH_STAR.md`](docs/TORQA_VISION_NORTH_STAR.md) · maturity detail: [`STATUS.md`](STATUS.md) |
| **Architecture** | TORQA-first layering (vs Python/Rust): [`docs/TORQA_DOMINANCE.md`](docs/TORQA_DOMINANCE.md) (P30 milestone) · [`docs/ARCHITECTURE_RULES.md`](docs/ARCHITECTURE_RULES.md) · [`docs/SURFACE_CLASSIFICATION.md`](docs/SURFACE_CLASSIFICATION.md) |
| **Product website** | All in [`website/`](website/) — Vite app + `npm run build` → `website/dist/site/`, FastAPI in `website/server/`, `torqa-console` · [`docs/P72_WEBSITE_OFFICIAL.md`](docs/P72_WEBSITE_OFFICIAL.md) |
| **Desktop trial UX (P130)** | Electron app surfaces **token savings**, **API usage**, **heuristic quality score**, and **per-run reliability** (first-pass vs recovered) after `generate-tq` / `app` — see [`desktop/README.md`](desktop/README.md). |
| **Desktop distribution (P133)** | **Windows NSIS** installer (`npm run pack:win` in `desktop/`) — [`docs/P133_DESKTOP_DISTRIBUTION.md`](docs/P133_DESKTOP_DISTRIBUTION.md) (core still via `pip install -e .`). |
| **Trial feedback & telemetry (P135)** | TORQA Desktop: **local-only** session events + optional feedback JSON (no auto upload) — [`docs/P135_TRIAL_FEEDBACK.md`](docs/P135_TRIAL_FEEDBACK.md) · **Feedback** tab in the app. |
| **Launch comparison (P136)** | **Reference vs live** story + machine JSON — [`docs/COMPARISON_REPORT.md`](docs/COMPARISON_REPORT.md), `torqa-comparison-report`, website Proof page + desktop **Models** tab. |
| **Pre-trial audit (P137)** | Quality / reliability / UX checklist + high-severity fixes — [`docs/P137_TRIAL_QUALITY_AUDIT.md`](docs/P137_TRIAL_QUALITY_AUDIT.md). |

---

## Try it in three steps

**Full walkthrough (install, Windows, fallbacks):** **[`docs/QUICKSTART.md`](docs/QUICKSTART.md)** ← start here if you are new.

1. **Install** (repo root, Python 3.10+):

   ```bash
   python -m pip install -e .
   ```

   This registers the **`torqa`** command (see `pyproject.toml` `[project.scripts]`). Confirm with `torqa --version`.

2. **First build** (one command):

   ```bash
   torqa build examples/workspace_minimal/app.tq
   ```

3. **Next:** **[`docs/TRY_TORQA.md`](docs/TRY_TORQA.md)** for the full trial map — then **[`docs/FLAGSHIP_DEMO.md`](docs/FLAGSHIP_DEMO.md)** / **`torqa demo`**, or **[`docs/FIRST_REAL_DEMO.md`](docs/FIRST_REAL_DEMO.md)** for an alternate `.tq` → website walkthrough, or [`docs/FIRST_PROJECT.md`](docs/FIRST_PROJECT.md) for templates and packages ([`docs/USING_PACKAGES.md`](docs/USING_PACKAGES.md)).

If `torqa` is not on `PATH` (see **[`docs/QUICKSTART.md`](docs/QUICKSTART.md)** for `sysconfig` / venv / Windows `Scripts`): use the same interpreter — `python -m torqa build examples/workspace_minimal/app.tq` — or `python -m src.cli.main …` (identical entrypoint).

---

## Public flagship demo

**Story:** One benchmark-shaped **login + dashboard** flow shows **semantic compression** (small `.tq` vs NL task + generated app scale) and a **hard validation gate** (bad specs never complete a clean materialize path). The same paths power **CLI**, **gate proof**, **compression report**, the **marketing site** (`torqa-console` **`/`**), and **TORQA Desktop** (`torqa-desktop`). **`/console`** redirects to **`/`** — use Desktop or CLI for authoring ([`docs/TRY_TORQA.md`](docs/TRY_TORQA.md)).

**Single entry for the flagship demo:** run this from the repo root (after install); it prints the full trial path (verify, build, console, proofs):

```bash
torqa demo
```

**Then** follow that output. The build step is:

```bash
torqa build examples/benchmark_flagship/app.tq
```

**Sanity check (before or after reading the printout):** `torqa demo verify` · Legacy duplicate script: `torqa-flagship`

**Full walkthrough (metrics, gate, web/desktop, outputs):** **[`docs/FLAGSHIP_DEMO.md`](docs/FLAGSHIP_DEMO.md)**

### Public token proof (workflow benchmark, P77)

**Reusable summary** (deterministic estimator; refresh numbers with `torqa-token-proof` after scenario changes):

- **Suite:** `token_proof_workflow_v1` — five **workflow / automation-shaped** scenarios (forms, approvals, pipelines, logic, small scripts), each with fixed `TASK.md`, `BASELINE_CODE.txt`, and `.tq` that must pass **core validation**.
- **Latest checked-in run:** **5/5** scenarios passing; **~72%** average prompt-token reduction vs `.tq` (same intent, utf8÷4 token estimate); combined NL+baseline÷TORQA **~8.9×** on average.
- **Not the headline here:** generated website/UI bundle size — use the **flagship compression** path (`torqa-compression-bench`, `docs/BENCHMARK_COMPRESSION.md`) for that slice.
- **Inspect:** **[`docs/TOKEN_PROOF.md`](docs/TOKEN_PROOF.md)** · **[`reports/token_proof.json`](reports/token_proof.json)** (`summary` + `public_summary` for copy).

**Product framing (honest):** *In this benchmark set, TORQA expressed the same workflow intent with substantially fewer estimated tokens than the paired natural-language prompts, while the `.tq` surfaces satisfy strict core validation.* See the doc for limits and what is not measured.

---

## Why TORQA is different

- **Explicit semantics** and **diagnostics** (formal phases) instead of “hope the codegen matches intent.”
- **One IR** can drive multiple surfaces (see `torqa build` output under `generated_out/`).
- **AI-friendly:** structured output and validation hooks; see north star doc above.

---

## Showcase examples (pick one track)

| Track | Start here |
|-------|------------|
| **Public flagship (P35)** | **[`docs/FLAGSHIP_DEMO.md`](docs/FLAGSHIP_DEMO.md)** · `torqa demo` · [`examples/benchmark_flagship/`](examples/benchmark_flagship/) |
| **Flagship website demo** | [`docs/FIRST_REAL_DEMO.md`](docs/FIRST_REAL_DEMO.md) · [`examples/torqa_demo_site/app.tq`](examples/torqa_demo_site/app.tq) |
| **P31 benchmark baseline** | [`docs/BENCHMARK_FLAGSHIP.md`](docs/BENCHMARK_FLAGSHIP.md) · [`examples/benchmark_flagship/app.tq`](examples/benchmark_flagship/app.tq) |
| **P32 compression metrics** | [`docs/BENCHMARK_COMPRESSION.md`](docs/BENCHMARK_COMPRESSION.md) · `torqa-compression-bench` |
| **P77 token proof (multi-scenario)** | [`docs/TOKEN_PROOF.md`](docs/TOKEN_PROOF.md) · `torqa-token-proof` · [`reports/token_proof.json`](reports/token_proof.json) |
| **P33 validation gate proof** | [`docs/VALIDATION_GATE.md`](docs/VALIDATION_GATE.md) · `torqa-gate-proof` · [`examples/benchmark_flagship/gate_invalid/`](examples/benchmark_flagship/gate_invalid/) |
| **P34 Web/Desktop demo** | [`docs/DEMO_SURFACES.md`](docs/DEMO_SURFACES.md) · `torqa-console` · **`torqa-desktop`** (Electron in `desktop/`) |
| **P36 / P73 UI surfaces** | [`docs/UI_SURFACE_RULES.md`](docs/UI_SURFACE_RULES.md) · `/` marketing site · `/console` → `/` · `/desktop` → desktop pointer · [`docs/P73_PRODUCT_SURFACES.md`](docs/P73_PRODUCT_SURFACES.md) |
| **First `.tq`** | [`examples/workspace_minimal/app.tq`](examples/workspace_minimal/app.tq) + [`examples/torqa/templates/`](examples/torqa/templates/) |
| **Illustrative flows** | [`examples/torqa/auth_login.tq`](examples/torqa/auth_login.tq), [`examples/torqa/signin_flow.tq`](examples/torqa/signin_flow.tq) |
| **IR package + compose** | [`docs/USING_PACKAGES.md`](docs/USING_PACKAGES.md) · runnable tree [`examples/package_demo/`](examples/package_demo/) |
| **TORQA → TORQA (self-host)** | [`examples/torqa_self/`](examples/torqa_self/) + [`docs/SELF_HOST_MAP.md`](docs/SELF_HOST_MAP.md) — grouped policy bundles; quick index: `torqa --json language --self-host-catalog` |

---

## Documentation hub

**[`docs/DOC_MAP.md`](docs/DOC_MAP.md)** — all entry points (specs, roadmap, security, packages).

| Doc | Role |
|-----|------|
| [TRY_TORQA.md](docs/TRY_TORQA.md) | **P132:** canonical try path + official surfaces (CLI, website, desktop) |
| [WHAT_TORQA_DOES_BEST.md](docs/WHAT_TORQA_DOES_BEST.md) | **P132:** single product story — where TORQA shines |
| [KNOWN_LIMITS.md](docs/KNOWN_LIMITS.md) | **P132:** honest scope boundaries (trial, tokens, AI, hosting) |
| [P133_DESKTOP_DISTRIBUTION.md](docs/P133_DESKTOP_DISTRIBUTION.md) | **P133:** Windows installer build + trial install steps + QA checklist |
| [FLAGSHIP_DEMO.md](docs/FLAGSHIP_DEMO.md) | **P35:** public flagship walkthrough + stable commands |
| [QUICKSTART.md](docs/QUICKSTART.md) | Canonical install + first success |
| [FIRST_PROJECT.md](docs/FIRST_PROJECT.md) | After first build |
| [USING_PACKAGES.md](docs/USING_PACKAGES.md) | IR packages + compose |
| [PACKAGE_DISTRIBUTION.md](docs/PACKAGE_DISTRIBUTION.md) | Publish / fetch / `ref:` |
| [RELEASE_AND_VERSIONING.md](docs/RELEASE_AND_VERSIONING.md) | Tags, changelog, stability wording |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [ROADMAP.md](ROADMAP.md) | Staged direction (EN) |
| [ARCHITECTURE_RULES.md](docs/ARCHITECTURE_RULES.md) | **P18:** TORQA vs Rust/Python roles; self-host lock reminder |
| [SURFACE_CLASSIFICATION.md](docs/SURFACE_CLASSIFICATION.md) | **P18:** repo areas by product emphasis |

**Cheatsheet:** [`docs/TQ_AUTHOR_CHEATSHEET.md`](docs/TQ_AUTHOR_CHEATSHEET.md) · **Run generated web UI:** [`docs/DEMO_LOCALHOST.md`](docs/DEMO_LOCALHOST.md).

---

## Developer setup

```bash
pip install -r requirements-dev.txt
pip install -e ".[dev]"
python -m pytest
```

Optional Rust: `cargo test --manifest-path rust-core/Cargo.toml`

**Web:** `pip install -r requirements.txt` then `torqa-console` or `python -m website.server` → **`/`** marketing site (JSON APIs for local preview) ([`docs/TRY_TORQA.md`](docs/TRY_TORQA.md) · [`docs/UI_SURFACE_RULES.md`](docs/UI_SURFACE_RULES.md)). Docker: `docker compose up --build` → `http://127.0.0.1:8000`.

**IDE:** open [`Torqa.code-workspace`](Torqa.code-workspace) so the window title shows TORQA.

**Maintainer checks:** [`docs/MAINTAINER_VERIFY.md`](docs/MAINTAINER_VERIFY.md).

---

## Authoritative surfaces

| Surface | Where |
|---------|--------|
| CLI | `torqa` → [`src/cli/main.py`](src/cli/main.py) |
| Python embed | [`src/torqa_public.py`](src/torqa_public.py) · [`docs/PACKAGE_SPLIT.md`](docs/PACKAGE_SPLIT.md) |
| IR schema | [`spec/IR_BUNDLE.schema.json`](spec/IR_BUNDLE.schema.json) |

Legacy: [`compat/`](compat/) — prefer `torqa` or `torqa_public` for new work.

---

## Security

[`docs/PROTOTYPE_SECURITY.md`](docs/PROTOTYPE_SECURITY.md) — treat AI output and generated code as **untrusted** until reviewed; do not expose the console to the public internet without hardening.

---

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## License

[MIT License](LICENSE)

# Project-X

AI-first **declarative core IR** with **verifier-first** semantics, **Rust-preferred** execution, and **human-facing projections** (TypeScript web app, SQL, Rust, Python, and others). The **canonical IR bundle** is the source of truth; generated files are projections only.

**Language positioning:** the core is designed as an **AI-native formal language** — natural language and LLMs *propose* bundles, but **validity, handoff, determinism, and semantics** are decided only by the in-repo verifier. There is no dependency on a model to *run* or *trust* the language: `project-x validate` / `project-x language` work offline. Use `project-x language` for the live list of builtins and rules that both humans and `ai-suggest` must respect.

**Try a full multi-surface demo:** `project-x demo` writes `generated/webapp` (Vite/React), `generated/sql/schema.sql`, and stub emitters for Rust/Python/Go/TS/C++ under the output directory (default `demo_out/`). Load `examples/core/demo_multi_surface_flow.json` in the web console and run the pipeline to inspect all artifact groups in the **Artifacts** tab.

## Quick start

### Install

```bash
pip install -r requirements-dev.txt
```

### Tests

```bash
python -m pytest
cargo test --manifest-path rust-core/Cargo.toml   # requires Rust toolchain
```

### Web console (recommended)

```bash
pip install -r requirements.txt
# Either (editable install adds the command):
project-x-console
# Or:
python -m webui
# Or raw uvicorn:
uvicorn webui.app:app --reload --host 127.0.0.1 --port 8000
```

Use `PROJECT_X_HOST` / `PROJECT_X_PORT` or `--host` / `--port`. Production: `project-x-console --no-reload`.

**Docker:** `docker compose up --build` then open `http://127.0.0.1:8000` (binds `0.0.0.0:8000` in the container). Optional: create `.env` with `OPENAI_API_KEY` for AI suggest inside the container.

Browse to `http://127.0.0.1:8000`. The UI uses **Monaco Editor** (VS Code engine) from a CDN for JSON editing: syntax highlighting, line numbers, minimap, and **Format** (or **Ctrl+S** / **Cmd+S** in the IR editor). If the CDN is blocked, it falls back to a plain textarea. Load golden examples, run the pipeline, diagnostics, mutations, or AI suggest when configured.

### CLI

Editable install (adds the `project-x` command):

```bash
pip install -e ".[dev]"
project-x demo
project-x guided examples/core/valid_minimal_flow.json --inputs-json "{\"username\":\"alice\"}"
project-x validate examples/core/valid_minimal_flow.json
project-x project examples/core/valid_minimal_flow.json --out generated_out
project-x run examples/core/valid_minimal_flow.json --inputs-json "{\"username\":\"alice\"}"
project-x language
project-x ai-suggest "minimal two-step login flow"
project-x patch examples/core/valid_minimal_flow.json mutations.json --out patched.json
```

Without install: `python -m src.cli.main validate <file.json>`.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/ir/` | Canonical IR types, JSON, validation, fingerprint |
| `src/semantics/` | Python semantic analyzer (fallback / parity) |
| `src/execution/` | IR execution + engine routing |
| `src/codegen/` | Projection builders (`artifact_builder`, `ir_to_projection`) |
| `src/orchestrator/` | End-to-end pipeline orchestration (`pipeline_run.py` shared by CLI + web `/api/run`) |
| `rust-core/` | Rust validation, semantics, execution, bridge binary |
| `examples/core/` | Golden IR JSON examples |
| `spec/IR_BUNDLE.schema.json` | JSON Schema for the bundle envelope |
| `docs/CORE_SPEC.md` | Normative IR contract (English) |
| `webui/` | FastAPI + static UI |

## Slogan

**Humans describe → AI formalizes → system verifies → projectors emit outputs.**

## Security

See `docs/PROTOTYPE_SECURITY.md` before exposing any generated artifact or the web UI beyond localhost.

## Contributing

See `CONTRIBUTING.md`.

## Status and architecture

- `STATUS.md` — honest maturity snapshot  
- `ROADMAP.md` — next milestones  
- `docs/ARCHITECTURE_STATUS.md` — layers and canonical vs transitional  
- `docs/WEBUI_AND_CLI_SURFACES.md` — API and CLI reference  
- `docs/UPGRADE_REPORT.md` — latest internal platform upgrade notes  

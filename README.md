# Project-X

AI-first **declarative core IR** with **verifier-first** semantics, **Rust-preferred** execution, and **human-facing projections** (TypeScript web app, SQL, Rust, Python, and others). The **canonical IR bundle** is the source of truth; generated files are projections only.

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
uvicorn webui.app:app --reload --host 127.0.0.1 --port 8000
```

Browse to `http://127.0.0.1:8000`. Load golden examples, run validation / engine / orchestrator, and inspect generated artifact previews.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/ir/` | Canonical IR types, JSON, validation, fingerprint |
| `src/semantics/` | Python semantic analyzer (fallback / parity) |
| `src/execution/` | IR execution + engine routing |
| `src/codegen/` | Projection builders (`artifact_builder`, `ir_to_projection`) |
| `src/orchestrator/` | End-to-end pipeline orchestration |
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

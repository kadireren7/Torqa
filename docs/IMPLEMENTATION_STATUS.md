# Implementation status (English)

This file summarizes what is **implemented** versus **roadmap** for the current tree.

## Implemented

- **Canonical IR** (`src/ir/canonical_ir.py`): serialization, normalization, fingerprint, structural + handoff validation.
- **Semantic layer** (Python + Rust): symbol and guarantee checks; Rust-preferred execution with Python fallback (`src/execution/engine_routing.py`).
- **Orchestrator**: projection planning, artifact generation, V4 maintenance pass (`SystemOrchestrator.run_v4`).
- **Projections**: Vite/React website skeleton from IR; **non-website targets** emit **IR-derived** Rust, Python, SQL, TypeScript, Go, and C++ text (not empty TODO stubs).
- **Golden examples** under `examples/core/` validated by **pytest** and **JSON Schema** (`spec/IR_BUNDLE.schema.json`).
- **Web console** (`webui/`): load examples, edit JSON, run validation / engine / orchestrator, preview artifacts.
- **CI** (`.github/workflows/ci.yml`): Python tests + Rust tests on Ubuntu.

## Partial / transitional

- **Legacy `CoreGoal` path** in `kural_parser.py` remains for migration; IR-native paths are canonical.
- **Rust toolchain** on developer machines: optional; Python fallback applies when the bridge fails.
- **Self-hosting / evolution modules** still contain placeholder artifacts compared to the main codegen path.

## Not claimed as complete

- Full multi-domain projection fidelity (e.g. production-grade SQL migrations, real auth servers).
- End-to-end **AI prompt → IR** product loop with automatic self-correction (contract is documented in `docs/CORE_SPEC.md`; wiring is your integration layer).
- Controlled **round-trip editing** from generated TypeScript/SQL back into core IR (architecture is specified; product UX is not finished here).

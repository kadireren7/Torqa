# Architecture status

Canonical direction: **IR-first**, **Rust-preferred engine**, **Python orchestration / tooling / fallback**.

| Layer | Role | Forward status |
|-------|------|----------------|
| `src/ir/` | Canonical types, JSON, validation, fingerprint | **canonical** |
| `src/semantics/` | Python semantic analysis | **active** (parity / fallback) |
| `src/execution/` | IR execution + routing | **active** |
| `src/bridge/` | Rust subprocess bridge | **active** |
| `rust-core/` | Validation, semantics, execution | **canonical engine** |
| `src/projection/` | Target selection | **active** |
| `src/codegen/` | Projections | **active** |
| `src/diagnostics/` | Codes, full report, system health | **active** |
| `src/ai/` | LLM proposal path | **active** (bounded) |
| `src/control/` | Mutations, patch preview, risk | **active** |
| `src/orchestrator/` | Pipeline composition | **active** |
| `src/editor/` | Editor contracts (tooling) | **transitional** |
| `src/app/kural_parser.py` | Surface language + legacy paths | **transitional** |
| Root `*.py` shims | Re-export `src.*` | **compatibility shim** |
| `src/evolution/` | Self-hosting experiments | **experimental** |

See also `MODULE_OWNERSHIP.md`, `DEPRECATION_MAP.md`.

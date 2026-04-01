## Rust Dominance Status (V6.0)

- Canonical IR remains the single source of truth.
- Default execution mode is `rust_preferred`.
- Rust is now primary for validation, handoff checks, semantic analysis, execution planning, execution, and after-state reporting.
- Python remains active for parser/normalization entry, bridge/orchestration fallback, editor/app-shell support, and non-critical tooling.
- Legacy CoreGoal execution path is marked deprecated.
- Python semantic primary path is marked deprecated and retained only for fallback/parity/testing.

## Engine Modes

- `python_only`: force Python path.
- `rust_preferred`: run Rust first, then fallback to Python only when needed.
- `rust_only`: run Rust only and fail fast on Rust errors.

## Ownership Snapshot

- Rust-owned: `ir_validation`, `ir_semantic_verifier`, `ir_execution_engine`.
- Python-owned: parser entry, orchestration shell, fallback bridge.
- Shared: canonical IR contract and system-wide orchestration metadata.

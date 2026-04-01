## Rust/Python Parity Status Report (V6.0)

Parity comparison function:

- `compare_rust_and_python_pipeline(ir_goal, demo_inputs=None) -> dict`

Compared fields:

- validation pass/fail
- semantic errors/warnings
- guarantee tables
- execution success/failure
- result text
- executed transition count
- after-state summary keys

Current behavior:

- Rust pipeline is the preferred forward path.
- Python pipeline remains available for fallback and parity verification.
- Routing output includes whether fallback occurred and parity summary checks.

Determinism:

- Fingerprints are produced on both sides for canonical IR payloads.
- Bridge exchange uses deterministic JSON keys and English-only output messages.

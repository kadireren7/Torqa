# Module ownership

| Area | Primary owner | Notes |
|------|---------------|--------|
| IR schema + validation | **shared** (Python spec, Rust impl) | `CANONICAL_IR_VERSION` in Python is contract anchor |
| Semantic verifier | **Rust** preferred | Python mirrors for fallback/tests |
| Execution | **Rust** preferred | `engine_routing` selects path |
| Projection strategy | **Python** | Consumes semantic report only |
| Codegen / artifacts | **Python** | IR-derived text; not source of truth |
| Web UI | **Python** (FastAPI) | Internal control surface |
| CLI | **Python** | Thin wrapper over `src.*` |
| AI adapter | **Python** | Proposal only; all output validated |

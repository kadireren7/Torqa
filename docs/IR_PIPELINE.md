# IR pipeline

1. **Ingest** — JSON bundle `{"ir_goal": ...}` (parser, AI adapter, or file).
2. **Structural** — `validate_ir`, handoff checks, determinism.
3. **Semantic** — symbol table, guarantees, registry-backed calls/effects.
4. **Engine** — `run_rust_pipeline_with_fallback` (validate → semantic → execute).
5. **Orchestrate** — projection plan → `artifact_builder` → consistency checks.
6. **Emit** — artifacts under `generated_*` paths (projections only).

Quality and explain layers: `build_ir_quality_report`, `explain_ir_goal`, `build_full_diagnostic_report`, `build_system_health_report`.

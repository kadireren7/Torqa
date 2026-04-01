# Projection model

- **Source of truth**: canonical IR only.
- **Strategy**: `choose_projection_targets` scores each language from IR + semantic report + `ProjectionContext`.
- **Transparency**: `explain_projection_strategy` returns ranked scores and rationale.
- **Outputs**: website (Vite/React) plus IR-derived stubs for Rust, Python, SQL, TS, Go, C++.
- **Quality**: `build_generation_quality_report` + existing website threshold helpers in `artifact_builder`.

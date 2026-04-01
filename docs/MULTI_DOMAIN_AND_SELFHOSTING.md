# Multi-domain projections and self-hosting direction

## Multi-domain (V3-style)

Goal: **one shared IR** with **domain-specific projectors**:

| Domain | Familiar projection | IR concepts |
|--------|---------------------|-------------|
| UI / app | TypeScript / TSX | goals, inputs as form fields, effects as client actions |
| Data | SQL / migrations | entities as tables, constraints as rules |
| Policy / workflow | YAML-like or DSL text | requires, forbids, transitions |
| Infra | JSON / TOML | environment bindings as metadata (careful: keep secrets out of IR) |

**Consistency rule:** cross-domain invariants (e.g. “same entity name”) should be expressed as IR-level checks or a small **cross-projection linter** that reads `IRGoal` plus planned targets—not by comparing generated files as source.

## Self-hosting (V4-style)

Phased approach:

1. **Describe** internal tools (parser, verifier hooks, projection drivers) as IR goals where it adds clarity.
2. **Generate** their projections from the same pipeline used for user workflows.
3. **Gradually replace** hand-written glue with generated artifacts, keeping tests and golden bundles as the guardrail.

The repository’s `self_hosting` / evolution modules are scaffolding; production self-hosting requires stable diagnostics (`src/diagnostics/`) and a locked IR contract before expanding scope.

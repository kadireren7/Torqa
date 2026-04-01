# Generation Plan Contract (V6.2)

Function: `build_generation_plan(ir_goal, projection_plan) -> dict`

## Required Keys

- `selected_targets`: ordered list of selected language/purpose targets
- `website_generation_profile`: profile flags for page/component/form/layout support
- `website_generation_ready`: boolean readiness flag
- `file_set`: grouped file outputs by artifact family
- `dependencies`: package/runtime dependencies by artifact family
- `artifact_ordering`: ordered generation phases
- `runtime_assumptions`: runtime expectations (node/package manager/preview)

## Rules

1. Keep target selection dynamic; do not force global domain-to-language mapping.
2. Ensure a website-capable path exists for V6.2 threshold.
3. Generation plan must be serializable and stable for CLI/report output.
4. Plan must be sufficient to drive artifact generation deterministically.

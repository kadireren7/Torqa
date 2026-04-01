# Patch (mutation) contract

- **Transport**: JSON array of objects `{ "mutation_type", "target", "payload" }`.
- **Hydration**: `src/control/ir_mutation_json.py` turns JSON `expr` dicts into `IRExpr` via `ir_expr_from_json`.
- **Validation**: `validate_ir_mutation` per step; batch via `apply_ir_mutation_batch`.
- **Preview**: `build_patch_preview_report` — proposed bundle, `compute_ir_diff`, diagnostics, `score_patch_risk`, semantic fix hints if invalid.
- **Risk**: `score_patch_risk` — heuristic internal scores, not security analysis.

Supported mutation types are defined in `validate_ir_mutation` in `ir_mutation.py`.

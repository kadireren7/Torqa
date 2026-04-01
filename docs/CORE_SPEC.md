# Core IR specification (v1.3)

This document is the **normative English contract** for the shared AI-native core as serialized JSON. Implementations (Python prototype, Rust engine, web UI) must treat **`ir_goal` inside the bundle** as the logical source of truth for pipeline input.

## Envelope

```json
{
  "ir_goal": { ... }
}
```

The canonical Python/Rust interchange uses this shape. Fingerprints and stable ordering are defined in `src/ir/canonical_ir.py` (`ir_goal_to_json`, `compute_ir_fingerprint`).

## Machine-readable schema

See [`spec/IR_BUNDLE.schema.json`](../spec/IR_BUNDLE.schema.json) (JSON Schema draft 2020-12). Tests validate golden examples against it.

## Semantic roles

| Section | `kind` (where applicable) | Role |
|--------|---------------------------|------|
| `preconditions` | `require` | What must hold before the flow proceeds. |
| `forbids` | `forbid` | States or combinations that must not occur. |
| `postconditions` | `postcondition` | Expected properties after transitions. |
| `transitions` | — | Named effects moving between `before` / `after` states. |
| `result` | — | Human-readable outcome label (projection-friendly). |

## Identifier conventions (integrity validation)

Python `validate_ir` enforces:

- Precondition ids: `c_req_NNNN` (four digits).
- Forbid ids: `c_forbid_NNNN`.
- Postcondition ids: `c_post_NNNN`.
- Transition ids: `t_NNNN`.
- All `condition_id` values are **globally unique** within the goal.
- Input `type`: one of `text`, `number`, `boolean`, `void`, `unknown`.

Stricter **Rust handoff** rules (ASCII identifiers, allowed operators) are checked separately via `validate_ir_handoff_compatibility`.

## Metadata

Required keys include `ir_version` (must match `CANONICAL_IR_VERSION` in code), `source`, and `canonical_language`. The reference bundle uses `ir_version` **1.3**.

## Projections

TypeScript, SQL, Rust, Python files under `generated/` are **projections**, not sources. Generated files should carry a header stating they are derived from the core IR.

## AI generation boundary

Tools that emit IR from natural language must:

1. Output JSON that satisfies this schema and `validate_ir`.
2. Pass `validate_ir_handoff_compatibility` before the Rust-preferred pipeline.
3. On failure, repair using structured error messages from the verifier—never bypass validation.

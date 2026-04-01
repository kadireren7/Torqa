# IR version migration (contract evolution)

`ir_version` in bundle metadata (currently **1.4**) is the compatibility anchor for the shared core. A concrete path **1.3 → 1.4** is implemented in `migrate_ir_bundle` (same IR shape; metadata bump; `validate_ir`).

## Principles

1. **Bump `CANONICAL_IR_VERSION`** in `src/ir/canonical_ir.py` when you make breaking structural or validation changes.
2. **Update** `spec/IR_BUNDLE.schema.json` and `docs/CORE_SPEC.md` in the same change.
3. **Provide migration** for older bundles: either a small Python script under `scripts/migrate_ir.py` (future) or documented field mappings.

## Non-breaking changes

Adding optional metadata keys, new diagnostic codes, or stricter verifier checks that only reject previously invalid IR can often stay on the same minor version if all previously valid bundles remain valid.

## Breaking changes

Examples: new required fields, renamed JSON keys, changed condition ID patterns, or new mandatory transitions. These require a **major or minor version bump** and a migration path.

## AI and tooling

Generators (LLM adapters) should target the current `ir_version` explicitly in the system prompt and be re-tested against `examples/core/` after each bump.

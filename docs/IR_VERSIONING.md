# IR versioning

- Current bundle metadata: **`ir_version` = `1.4`** (see `CANONICAL_IR_VERSION` in `canonical_ir.py`).
- **Migrations:** `migrate_ir_bundle` in `src/ir/migrate.py` supports **1.3 → 1.4** (metadata bump + `validate_ir`; optional `library_refs` preserved on the envelope).
- **Envelope:** bundles may include optional **`library_refs`** (name, version, optional fingerprint); unknown top-level keys are rejected by `validate_bundle_envelope` in tooling.
- Schema: `spec/IR_BUNDLE.schema.json`.
- Policy: see also `IR_VERSION_MIGRATION.md`.

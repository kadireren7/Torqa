# Torqa — canonical IR (JSON)

The **source of truth** for a Torqa workflow spec, once parsed, is the **`ir_goal`** object embedded in a small JSON **bundle**.

## Envelope

```json
{
  "ir_goal": { },
  "library_refs": [
    { "name": "example-lib", "version": "1.0.0", "fingerprint": "optional-sha256-hex" }
  ]
}
```

- **`ir_goal`** (required) — the workflow model.
- **`library_refs`** (optional) — reserved for shared libraries / packaging; the core validator does not require it.

## `ir_goal` fields (conceptual)

- **`goal`** — string identifier for the workflow (e.g. `UserLogin`).
- **`inputs`** — declared inputs with typed names (`text`, `number`, `boolean`, `void`, `unknown`).
- **`preconditions`**, **`forbids`**, **`postconditions`** — lists of **conditions** (`require` / `forbid` / `postcondition`) with structured expressions.
- **`transitions`** — side-effect steps with optional guards and effect names.
- **`result`** — human-facing completion string (may be null in some bundles).
- **`metadata`** — includes `ir_version`, provenance, optional `source_map` (e.g. `.tq` include trace).

Expression nodes are a **small AST**: identifiers, literals, calls, logical combinations, etc. The exact shapes are defined in code (`src/ir/canonical_ir.py`) and in machine-readable form below.

## Machine-readable schema

The bundle is described by [spec/IR_BUNDLE.schema.json](spec/IR_BUNDLE.schema.json) (JSON Schema, draft 2020-12). Tests validate representative bundles against this schema.

## Versioning

- The active IR version constant lives in Python as `CANONICAL_IR_VERSION` in `src/ir/canonical_ir.py` (currently **1.4**).
- **`migrate_ir_bundle`** in `src/ir/migrate.py` supports documented moves between versions (today: identity and **1.3 → 1.4** metadata bump).

## Fingerprints and serialization

`src/ir/canonical_ir.py` provides **deterministic JSON serialization** and a stable **fingerprint** helper for comparing bundles. Use these when you need reproducible hashes or round-trip tests.

## Why JSON IR?

- **Language-agnostic** — Rust, TypeScript, or other tools can consume the same artifact.
- **AI- and diff-friendly** — structured, tree-shaped, and easy to validate.
- **Human-inspectable** — unlike opaque bytecode; you can read and review the model directly.

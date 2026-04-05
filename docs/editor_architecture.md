# Editor Architecture (V6.1)

_End-user trial paths (CLI, desktop, marketing site): [`TRY_TORQA.md`](TRY_TORQA.md). This page is **internal** session architecture._

The editor is a headless IR-native architecture layer.  
It is the only supported write path for future application behavior.

## Core rule

The application must not mutate generated files directly.

All edits must flow through:

`user action → editor session → IR mutation → validation → previews → regenerated outputs`

## Ownership and boundaries

- Canonical IR is the source of truth.
- Rust is preferred for semantic/execution preview when available.
- Python remains fallback/orchestration support.
- `editor_core.py` does not depend on parser AST internals.

## Editor core responsibilities

- Controlled, transaction-safe edits
- Post-edit normalization and validation loop
- Structured diagnostics
- Undo/redo history and session state
- Preview model generation for app UI consumption
- JSON-safe session persistence

## Validation loop

For every edit transaction:

1. Apply operations transactionally
2. Normalize IR
3. Run Rust-preferred semantic validation (with Python fallback)
4. Run control/guardrail checks via edit engine
5. Build diagnostics + diff
6. Refresh preview models

On failure:

- rollback to previous IR snapshot
- keep session consistency
- return structured errors/diagnostics

# Editor Diagnostics Model (V6.1)

`EditorDiagnostic` is the structured diagnostic payload used by the headless editor.

## Structure

- `severity`: `error | warning | info`
- `message`: human-readable English text
- `related_ids`: optional list of related IDs (conditions/transitions/inputs)
- `suggested_fixes`: optional list of operation-ready fix payloads

## Sources

Diagnostics are aggregated from:

- transaction failures and rollback reasons
- semantic validation (Python)
- semantic/validation preview (Rust, when available)
- control/guardrail outcomes surfaced by edit transactions

## Behavior

- failed transaction → diagnostics include blocking `error` items
- warnings are preserved after successful commits
- diagnostics are exposed through:
  - `get_editor_diagnostics(session)`
  - `get_editor_views(session)["diagnostics_view"]`
  - `save_editor_session(session)["diagnostics_snapshot"]`

## Suggested fixes

When possible, diagnostics include operation-shaped fix hints:

```json
{
  "op_type": "update_expr",
  "target_path": "preconditions[0].expr",
  "payload": { "...": "..." }
}
```

These are intended for application shell workflows and automated fix UIs.

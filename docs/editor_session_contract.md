# Editor Session Contract (V6.1)

`EditorSession` is the application-facing state container for headless editing.

## Required state

- `ir_goal`: current canonical IR snapshot
- `engine_mode`: `python_only | rust_preferred | rust_only`
- `history`: undo/redo stacks (snapshot-based)
- `pending_diagnostics`: structured editor diagnostics
- `last_semantic_report`: latest Python semantic report
- `last_projection_plan`: latest projection strategy plan
- `last_execution_preview`: latest execution preview payload
- `last_validation_ok`: last successful validation state
- `dirty`: clean/dirty tracking for persistence

## App-facing API

- `create_editor_session(ir_goal, engine_mode="rust_preferred")`
- `apply_editor_operations(session, operations)`
- `preview_editor_state(session)`
- `undo_editor_change(session)`
- `redo_editor_change(session)`
- `get_editor_diagnostics(session)`
- `get_editor_views(session)`

## Operation contract

Operations include:

- `operation_id`
- `op_type`
- `target_path`
- `payload`
- `editor_metadata` (optional)

Supported edit intents include:

- add/remove input
- rename identifier
- change input type
- add/remove precondition
- add/remove forbid
- add/remove transition
- replace expression subtree
- reorder transitions
- update result text

## Persistence contract

- `save_editor_session(session) -> dict`
- `load_editor_session(data) -> EditorSession`

Persisted data includes:

- current IR snapshot
- history metadata and snapshots
- diagnostics snapshot
- engine mode
- deterministic JSON-safe fields only

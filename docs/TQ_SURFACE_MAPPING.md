# `.tq` surface (tq_v1) → `ir_goal` mapping

Authoritative for **syntax** accepted by `src/surface/parse_tq.py`.

**Quick reference for authors:** [`TQ_AUTHOR_CHEATSHEET.md`](TQ_AUTHOR_CHEATSHEET.md) (order, `flow:` indent, `requires` tips).

## Header order (strict)

1. Optional `module …` (at most once, only as the first header).
2. `intent …` (required).
3. Optional **one** `include "relative/path.tq"` (after `intent`, before `requires`; path relative to this file’s directory; nested `include` forbidden). See `examples/torqa/example_include_user_login.tq`.
4. `requires …` (required).
5. At most one `forbid locked`.
6. Optional `ensures session.created` (exact clause; once).
7. **`result` or `result …` (required)** before `flow:`.
8. `flow:` (once).

Header keywords are **case-sensitive** (lowercase ASCII only): `module`, `intent`, `include`, `requires`, `forbid`, `ensures`, `result`, `flow:`.

Parsing `include` requires a **file path** (CLI `surface` / `build`, or `parse_tq_source(..., tq_path=…)`). Raw string-only parse without `tq_path` fails with `PX_TQ_INCLUDE_NEEDS_PATH`.

Successful includes set `metadata.source_map.tq_includes` to the relative paths used (traceability only; same `ir_goal` shape as without include).

Any other order → `PX_TQ_HEADER_ORDER`. Missing `result` → `PX_TQ_MISSING_RESULT`.

## Singleton headers

`module`, `intent`, `requires`, `ensures`, `result`, `flow:` — at most once each (`PX_TQ_DUPLICATE_HEADER` where applicable).  
`include "…"` — at most one line (`PX_TQ_INCLUDE_DUPLICATE`).  
`forbid locked` — at most one line (`PX_TQ_DUPLICATE_FORBID`).

## Header → IR

| Line pattern | `ir_goal` effect |
|--------------|------------------|
| `module <text>` | `metadata.source_map.tq_module` |
| `intent <name>` | `goal` ← PascalCase of `<name>` (`-` in `<name>` is rejected) |
| `include "rel.tq"` | Text splice before parse; `metadata.source_map.tq_includes` |
| `requires a, b, …` | `inputs[]` + fixed precondition expansion |
| `forbid locked` | one `forbids[]` entry |
| `ensures session.created` | `postconditions[]` when `create session` step exists |
| `result` | `result` ← `"OK"` |
| `result <text>` | `result` ← trimmed text |
| *(no `result` line)* | `PX_TQ_MISSING_RESULT` |

## `flow:` body

- Each step line: **exactly two ASCII spaces**, then either `create session` or `emit login_success` (case-sensitive, no extra leading spaces in the step text).
- No blank lines inside the block (`PX_TQ_FLOW_BLANK_LINE`).
- Wrong indent → `PX_TQ_FLOW_INDENT`.
- After the last step, only blank lines and full-line `#` comments are allowed (`PX_TQ_CONTENT_AFTER_FLOW`).

Legacy steps (`validate …`, `find user …`, `verify password`) → `PX_TQ_LEGACY_FLOW_STEP`.

## Preconditions from `requires`

Unchanged: `exists` per name, `verify_username(primary)`, `verify_password(primary, password)`; `primary` = first name not in `{password, ip_address}`.

## Comments

Full-line `#` comments and blank lines are ignored in the **header** section and **after** the `flow:` block. Blank lines are **not** allowed inside `flow:`.

## Examples

See `examples/torqa/canonical_*.tq`, `examples/torqa/templates/`, and `examples/torqa/README.md`.

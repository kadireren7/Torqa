# `.tq` author cheatsheet (tq_v1)

One-page reminder. Full rules: [`TQ_SURFACE_MAPPING.md`](TQ_SURFACE_MAPPING.md).

## Header order (do not reorder)

1. Optional `module dotted.name` (only as first header).
2. `intent snake_case_name` (required; hyphens in the name are rejected).
3. Optional once: `include "relative.tq"` (after `intent`, before `requires`; needs file path when parsing).
4. `requires a, b, c` (required; comma-separated identifiers).
5. At most one `forbid locked`.
6. Optional `ensures session.created` (exact text).
7. `result` or `result Your message` (required before `flow:`).
8. `flow:` then step lines.

Keywords are **lowercase only** (`intent` not `Intent`; `flow:` not `Flow:`).

## `flow:` body

- Each step: **exactly two ASCII spaces**, then either `create session` or `emit login_success`.
- No blank lines inside the block.
- After the last step: only blank lines or full-line `#` comments.

## Login-oriented `requires`

- First field that is not `password` or `ip_address` is the **primary** (used for `verify_username` / `verify_email` style checks).
- Sign-in flows with `emit login_success` need `ip_address` in `requires` (audit arity).

## Copy-paste templates

See `examples/torqa/templates/`.

## Check your file

```bash
torqa surface your_file.tq
```

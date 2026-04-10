# Torqa — human surface (`.tq`)

The `.tq` extension denotes **Torqa text**: a **strict, line-oriented** format that maps to the canonical IR (`ir_goal` inside a JSON bundle). It is meant to be **readable by people** and **easy for tools to parse deterministically**.

## Design goals

- **Small vocabulary** — a handful of headers and a `flow:` block, not a general-purpose language.
- **Deterministic parsing** — same text always yields the same IR.
- **Validation-friendly** — invalid specs fail with stable error codes (e.g. `PX_TQ_*`), not silent fixes.

## Header order (`tq_v1` strict)

Headers are **lowercase** and must appear in this order (optional lines skipped where noted):

1. Optional `module <name>`.
2. Required `intent <snake_case_name>` — becomes the IR `goal` (PascalCase) unless overridden.
3. Optional `include "relative/path.tq"` lines (after `intent`, before `requires`).
4. Required `requires a, b, c` — comma-separated input names; types may be refined in “rich” blocks.
5. Optional `stub_path <lang> <relpath>` lines (projection hints for downstream tooling; ignored by the core semantic checker).
6. Optional `forbid locked` or richer forbid clauses (see parser).
7. Optional `ensures` lines (session / postconditions surface forms).
8. Required `result` or `result …` — human-readable completion message.
9. Required `flow:` block — indented steps.

After `flow:`, only blank lines or full-line `#` comments are allowed.

## Flow block

Each step line starts with **exactly two spaces** (no tabs). Typical steps include:

- `create session` — models session establishment before login-success effects.
- `emit login_success` — or guarded forms such as `emit login_success when <ident>` / `if <ident>` (same meaning).

Full-line comments inside `flow:` start with `#` after the two-space indent.

## Rich surface (optional)

The parser also supports **rich** blocks (model typing, validation rules, grouped steps, `each` loops) layered on the same strict header discipline. Errors refer to **TQ_SURFACE.md** and the implementation in `src/surface/tq_rich_parse.py`.

## Transitional surface: `.pxir`

`src/surface/parse_pxir.py` supports a **legacy / transitional** surface. New work should prefer **`.tq`**.

## Pointers

- JSON shape produced: see [CANONICAL_IR.md](CANONICAL_IR.md).
- Semantic rules over IR: see [SEMANTICS.md](SEMANTICS.md).
- Worked examples: see [EXAMPLES.md](EXAMPLES.md).

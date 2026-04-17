# Concepts

Definitions tied to what Torqa **actually ships**: **canonical IR**, **validation**, and—optionally—**`.tq`** as a text authoring path.

## Torqa Core: bundle, `ir_goal`, and validation

The **product contract** is the **JSON bundle** whose main payload is **`ir_goal`**: goal name, **inputs**, **preconditions** / **forbids** / **postconditions**, **transitions** (effects), **result** text, and **metadata** (including **`ir_version`**).

You obtain that data by:

- Parsing **`.tq`** with the **reference parser** (see below), **or**
- **Loading** JSON that matches the envelope (your importer, tests, or tooling)—the same **`ir_goal_from_json`** → **`validate_ir`** → **`build_ir_semantic_report`** path applies.

The bundle aligns with **`spec/IR_BUNDLE.schema.json`**. Optional **`library_refs`** may appear at the envelope level; the core validators do not require them.

**Structural validation** — `validate_ir(goal)` asks whether the IR obeys the data model. An **empty** error list means OK.

**Semantic validation** — `build_ir_semantic_report(goal, registry)` asks whether the workflow is coherent under a **declared effect registry** and logic rules. **`semantic_ok: true`** means no blocking semantic or logic errors (warnings may still apply).

**Effect registry** — The shipped **`default_ir_function_registry()`** covers a **small, fixed** set of effects. Unknown effect names are **errors**—by design.

### CLI: `.tq` and `.json` are first-class inputs

The **`torqa`** command picks the loader by **file extension**:

- **`.tq`** — reference text parser (`parse_tq_source`).
- **`.json`** — UTF-8 JSON: either a **bundle** `{"ir_goal": {...}}` (optional `library_refs`) validated with **`validate_bundle_envelope`**, or a **bare `ir_goal`** object whose top-level keys match the wire shape (required fields per schema; optional `result`).

After load, **`ir_goal_from_json`**, **`validate_ir`**, and **`build_ir_semantic_report`** run the same way for both. **`torqa inspect`** prints only JSON on **stdout** (path and a short note on **stderr** so pipes stay clean).

Parse errors for **wrong header order** use code **`PX_TQ_HEADER_ORDER`** and name the **expected next header** (tq_v1 sequence: optional `module` → `intent` → `requires` → … → `result` → `flow:`). Unknown **`flow:`** steps use **`PX_TQ_UNKNOWN_FLOW_STEP`** with the allowed step names spelled out.

## `.tq` — optional ergonomic authoring surface

**`.tq`** is **strict, line-oriented text** so humans (and tools that emit text) can author specs **without hand-writing JSON**. It is **not** the only way to produce IR—only the **reference** path implemented here for **readable** workflow files.

Files use the **`.tq`** extension. Headers follow a **fixed order**; putting `result` before `intent`, or `requires` before `intent`, triggers an explicit order error (not a generic “missing line” only). Steps under **`flow:`** use **two-space** indentation (not tabs). That rigidity keeps parsing **deterministic** for this surface.

Minimal shape:

```text
intent login_check
requires username, password, ip_address
result All good
flow:
  create session
  emit login_success
```

- **`intent`** — Surface name; IR **`goal`** is derived (e.g. `LoginCheck`).
- **`requires`** — Declared inputs.
- **`result`** — Human-readable completion line.
- **`flow:`** — Ordered steps supported by this profile (`create session`, `emit login_success`, guarded forms).

Invalid **`.tq`** raises **`TQParseError`** with stable **`PX_TQ_*`** codes.

### Optional `meta:` block (audit / ownership)

Structured **string** labels (owner, severity, etc.) **without** changing transitions—placed after **`requires`** and **before `result`**:

```text
meta:
  owner security_team
  severity high
```

Rules: two-space indent per line; **snake_case** keys; value is the rest of the line; duplicate keys are errors. Stored in **`metadata.surface_meta`**. Not executed as effects.

**`.pxir`** is a **legacy** text surface; for new **text** work prefer **`.tq`**.

## Structural validation (IR)

**“Does this IR obey the data model?”** — `validate_ir(goal)` returns a **list of error strings**. An **empty list** means structurally OK.

```python
errors = validate_ir(goal)
# []  → pass
# ["..."]  → fail; fix IR or upstream producer
```

## Semantic validation (IR)

**“Under our declared effects, is this workflow coherent?”** — `build_ir_semantic_report` combines registry checks and logic validation (e.g. session vs. login ordering). The report includes **`semantic_ok`**, **`errors`**, **`warnings`**, **`logic_ok`**, and related diagnostics.

You extend semantics by **growing the registry** you pass in—not by disabling core checks.

## Multiple inputs over time

Today this repository provides **one** reference **text** parser (`.tq`) plus **JSON** loading for **`ir_goal`**. The **same validation stack** applies regardless. Additional **front-ends** (other text dialects, importers, IDE plugins) would still target **the same canonical bundle**—that is how Torqa stays **one contract** while inputs multiply.

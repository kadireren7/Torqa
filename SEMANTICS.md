# Torqa — semantics over IR

Parsing `.tq` into JSON is only the first gate. Torqa’s **semantic layer** asks: *does this IR describe a coherent workflow under a fixed interpretation of effects and data?*

Implementation entry points:

- `src/semantics/ir_semantics.py` — registry of effect/function shapes, guarantee tables, and `validate_ir_semantics` / `build_ir_semantic_report`.
- `src/semantics/ir_logic_validation.py` — cross-condition and transition **logic** checks (e.g. session lifecycle vs. login success).
- `src/semantics/torqa_semantic_policy.py` — optional **non-fatal advisories** (warnings) toggled via policy inputs.

## What “semantic_ok” means

`build_ir_semantic_report` returns a dictionary. Roughly:

- **`semantic_ok: true`** — no semantic **errors**; optional **warnings** may still be present depending on policy.
- **`semantic_ok: false`** — at least one **error** string explains the inconsistency (unknown effect, arity mismatch, missing guarantee, forbidden pattern, etc.).

Structural problems are caught earlier by `validate_ir` on `IRGoal` objects (`src/ir/canonical_ir.py`).

## Effect registry

The prototype ships a **default registry** (`default_ir_function_registry()`) that knows about a small set of **named effects** and **predicates** used in examples (e.g. session creation, login success logging). Unknown names produce **errors**, not silent acceptance—this is deliberate for a spec language.

## Logic validation examples

The logic layer enforces **workflow-shaped common sense**, for example:

- If a transition logs a successful login, the model should **establish a session** first.
- Certain **forbid** / **require** combinations must be consistent with **before/after** identifier guarantees.

These rules are **not** arbitrary lint: they encode **interpretations** that keep the IR from claiming impossible or self-contradictory automation stories.

## Optional warning policy bundle

If a file named `semantic_warning_policy_bundle.json` exists at the **repository root**, it can tune which **advisory** warnings are enabled and optional soft limits. If the file is absent, built-in defaults apply (see `load_global_semantic_policy`).

Core **errors** are never disabled by that file.

## Mental model

Think of Torqa semantics as a **contract**:

1. **Syntax / shape** — JSON and IR object invariants.
2. **Kind / type** — basic typing of inputs and expressions.
3. **Logic** — cross-step consistency.
4. **Policy** — configurable advisories on top.

This stack keeps the **meaning** of a Torqa bundle stable even when new projections or tools are added later.

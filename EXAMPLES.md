# Torqa — examples

Minimal patterns you can paste into a `.tq` file. Adjust names to taste; keep **header order** and **two-space** flow indentation.

## Minimal session + login success

```text
intent example_flow
requires username, password, ip_address
result Done
flow:
  create session
  emit login_success
```

**Notes**

- `ip_address` in `requires` is required for this effect pattern in strict `tq_v1` (audit / guard rails in the parser).
- `create session` must appear **before** `emit login_success` so semantic logic passes.

## Parse from Python

```python
from pathlib import Path
from src.surface.parse_tq import parse_tq_source

src = Path("flow.tq").read_text(encoding="utf-8")
bundle = parse_tq_source(src, tq_path=Path("flow.tq"))
print(bundle["ir_goal"]["goal"])
```

## Validate structure + semantics

```python
from src.ir.canonical_ir import ir_goal_from_json, validate_ir
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry

goal = ir_goal_from_json(bundle)
print("structural:", validate_ir(goal))
print(build_ir_semantic_report(goal, default_ir_function_registry()))
```

## JSON Schema check (optional)

With `jsonschema` installed:

```python
import json
from pathlib import Path
import jsonschema

schema = json.loads(Path("spec/IR_BUNDLE.schema.json").read_text(encoding="utf-8"))
jsonschema.Draft202012Validator(schema).validate(bundle)
```

## Optional policy bundle filename

To customize **advisory** warnings, add `semantic_warning_policy_bundle.json` at the repo root (see [SEMANTICS.md](SEMANTICS.md)). The core remains usable without this file.

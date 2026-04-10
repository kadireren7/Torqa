# Torqa (core)

Torqa is a **small, human-readable workflow surface** (`.tq` files) that compiles to a **canonical JSON intermediate representation (IR)**. The IR is **structurally validated** and checked with a **lightweight semantic layer** (guards, effects, and consistency rules) before you treat a spec as “good.”

This repository is intentionally **minimal**: language definition, reference Python implementation, JSON Schema, and tests. There is **no** desktop app, website, codegen pipeline, or LLM product here—only the **idea and the core**.

## Documentation (five files)

| File | Purpose |
|------|---------|
| [README.md](README.md) | This overview and how to run tests |
| [TQ_SURFACE.md](TQ_SURFACE.md) | The `.tq` human authoring format |
| [CANONICAL_IR.md](CANONICAL_IR.md) | The JSON IR envelope and versioning |
| [SEMANTICS.md](SEMANTICS.md) | What the semantic checker enforces |
| [EXAMPLES.md](EXAMPLES.md) | Copy-paste examples |

## Quick start (developers)

```bash
pip install -e ".[dev]"
python -m pytest
```

### Use from Python

```python
from src.surface.parse_tq import parse_tq_source
from src.ir.canonical_ir import ir_goal_from_json, validate_ir
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry

bundle = parse_tq_source(open("flow.tq", encoding="utf-8").read())
goal = ir_goal_from_json(bundle)
assert not validate_ir(goal)
report = build_ir_semantic_report(goal, default_ir_function_registry())
assert report["semantic_ok"]
```

## License

[MIT](LICENSE).

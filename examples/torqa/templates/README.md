# `.tq` templates

Install and first build: [`docs/QUICKSTART.md`](../../../docs/QUICKSTART.md).

Copy a file into your project, then from the **repository root** (after `pip install -e .`):

```bash
torqa surface your_copy.tq
torqa build your_copy.tq
```

| File | Use |
|------|-----|
| `minimal.tq` | Smallest valid file (empty `flow:`). |
| `login_flow.tq` | Session + audit steps; matches canonical login IR shape. |

Known-good build without copying: `torqa build examples/workspace_minimal/app.tq`.

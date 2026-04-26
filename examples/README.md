# Examples

**Copy-paste specs** and JSON bundles to learn Torqa in minutes. Everything here runs through the same **`torqa validate`** / **`torqa scan`** gates as production IR.

## Start here (2 minutes)

From the **repository root** after `pip install -e ".[dev]"` (see [README — Install](../README.md#install)):

```bash
torqa validate examples/templates/login_flow.tq
torqa scan examples/templates --profile default
```

| Path | What it is |
| --- | --- |
| **[templates/](templates/)** | Starter **`.tq`** flows (login, approval, onboarding) + safe/risky JSON pairs |
| **[integrations/](integrations/)** | n8n export examples for adapter-based `--source n8n` flows |
| **[`approval_flow.tq`](approval_flow.tq)** | Single-file approval example at repo examples root |
| **[`ai_generated.json`](ai_generated.json)** | AI-style bundle JSON for guardrail demos |
| **[`ai_guardrail.md`](ai_guardrail.md)** | Command-oriented walkthrough |
| **[`ci_check.md`](ci_check.md)** | CI-oriented notes |
| **[`self_test_broken/`](self_test_broken/)** | **Intentionally invalid** specs for parser/policy tests — expect failures |

Deeper patterns (metadata, migration, CI): **[Examples guide](../docs/examples.md)** · **[First run](../docs/first-run.md)**.

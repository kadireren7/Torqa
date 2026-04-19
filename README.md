# Torqa

**A small, test-backed core for workflow specs:** one canonical **`ir_goal`** representation, structural and semantic validation, and deterministic **policy / risk / profiles**—so you can gate handoff before anything runs. This repo does **not** execute workflows, call models, or host a service.

---

## Problem

Workflow intent shows up as prose, ad hoc JSON, vendor formats, or **generated** drafts. Syntax checks alone do not tell you whether a spec is safe to hand off: you still need **structure**, **semantics**, and **agreed rules** (metadata, limits, severity) visible before execution.

Torqa focuses on that gap: **verifiable IR + explicit trust signals**, not faster runtimes.

---

## Solution

- **Canonical IR** (`ir_goal` in a versioned bundle) as the interchange contract—store it, diff it, run it in CI.
- **Validation pipeline:** structural (`validate_ir`), semantic (effect registry, logic), then **`build_policy_report`** (policy pass/fail, review signals, deterministic risk tier and reasons).
- **Trust profiles** (`default`, `strict`, `review-heavy`) so “pass” can mean different strictness without forking parsers.
- **Reference `.tq` surface** that maps deterministically to the same bundle shape as JSON importers.
- **Execution stays yours**—orchestrators, executors, and codegen live outside this repository.

---

## Why now

More specs are **produced by tools** and **composed across systems**; teams need reviewable artifacts and **gates** they can repeat in CI, not only happy-path demos. Torqa keeps checks **deterministic and inspectable** (heuristics and rules, not ML inside this core). Context: [Why now?](docs/why-now.md).

---

## Quick start

From a clone of this repository:

```bash
pip install -e ".[dev]"
```

If `torqa` is not on your `PATH` (common on Windows), use:

```bash
python -m src.torqa_cli validate path/to/spec.tq
```

Full install notes, every subcommand, and **`.json`** shapes (bundle, bare `ir_goal`, optional batch array): **[Quickstart](docs/quickstart.md)**. Shortest “what success looks like”: **[First run](docs/first-run.md)**.

---

## Trust layer demo

End-to-end walkthroughs using **only** what ships here—valid vs broken specs, policy/risk/profiles, same gate for **`.tq`** and JSON:

- **[AI Workflow Guardrail Demo](docs/guardrail-demo.md)** — practical guardrail framing.
- **[Flagship demo](docs/flagship-demo.md)** — draft → validate → handoff-shaped narrative.

Deeper concept: **[Trust layer](docs/trust-layer.md)**.

---

## Commands

| Command | Role |
|--------|------|
| `torqa validate` | Full pipeline; exit 0 only when load, structure, semantics, and policy pass. |
| `torqa check` | Compact trust summary (decision, risk, profile, readiness score). |
| `torqa scan` / `torqa report` | Directory or multi-spec reports (HTML / Markdown for CI). |
| `torqa compare` | Same file under each built-in profile (tabular). |
| `torqa explain` | Plain-English sections from existing signals (no AI). |
| `torqa inspect` | Canonical IR JSON on stdout (pipelines). |
| `torqa doctor` | Human-readable diagnostics and readiness. |
| `torqa init` | Starter `.tq` templates. |

Optional **`torqa.toml`** for project defaults: **[Project config](docs/project-config.md)**. CI report artifacts: **[CI reports](docs/ci-report.md)**.

---

## Examples

- **[Examples guide](docs/examples.md)** — CI, metadata, migration patterns.
- **`examples/`** — templates (login, approval, onboarding), AI-style JSON samples, **[`examples/ai_guardrail.md`](examples/ai_guardrail.md)** for command-oriented walkthroughs.

---

## Status

**Early core (v0.x).** Python under `src/`, schema at `spec/IR_BUNDLE.schema.json`, tests in `tests/`. Prefer **`.tq`** for new text authoring; transitional **`.pxir`** exists for migration only. In scope: **IR**, validation, trust evaluation—not execution, not a hosted product.

**Repository audit and pre-v1 gaps (honest, living):** **[docs/status.md](docs/status.md)** — product/CLI/trust/docs/adoption snapshot and what typically precedes a **1.0** contract freeze.

See **[CHANGELOG](CHANGELOG.md)** and **[Early release notes](RELEASE_NOTES_v0.md)** for what shipped and current limits.

---

## Roadmap

Planning stays **small API, reference implementation, no platform wraparound**. Near-term: clearer errors, examples that track the real parser, docs that match the code. Long-term possibilities are optional and explicitly **not** runtime/SaaS—see **[Roadmap](docs/roadmap.md)** for non-goals and directions (not release promises).

---

## Architecture at a glance

Pipeline and boundaries: **[Diagrams](docs/diagrams.md)** · **[Architecture](docs/architecture.md)**.

## Minimal example (`.tq` → validate)

`example.tq` (policy expects **`meta:`** with owner and severity; see [Trust policies](docs/trust-policies.md)):

```text
intent example_flow
requires username, password, ip_address
meta:
  owner example_owner
  severity low
result Done
flow:
  create session
  emit login_success
```

```python
from pathlib import Path

from src.surface.parse_tq import parse_tq_source
from src.ir.canonical_ir import ir_goal_from_json, validate_ir
from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry

bundle = parse_tq_source(
    Path("example.tq").read_text(encoding="utf-8"),
    tq_path=Path("example.tq"),
)
goal = ir_goal_from_json(bundle)
assert validate_ir(goal) == []
report = build_ir_semantic_report(goal, default_ir_function_registry())
assert report.get("semantic_ok") is True
```

CLI trust output (policy, risk, profiles): **`torqa validate`** — [Quickstart](docs/quickstart.md).

## What Torqa is — and is not

**Is:** a **contract** (`ir_goal` + validation + trust evaluation), portable and reviewable.

**Is not:** a workflow runtime, orchestration engine, hosted service, IDE product, or bundled LLM API. The core is IR + checks; **`.tq`** is one authoring path today, not a forever lock-in.

## Contributing

We welcome issues and pull requests. Start here:

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — setup, tests, scope, PR expectations  
- **[GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md)** — realistic entry points by area  
- **[Architecture — contributor notes](docs/architecture.md#contributor-notes)** — where code in each layer usually lives  

## Documentation

**Landing readers:** the sections above link to the essentials. Everything below is the full map.

- [Overview](docs/overview.md) — scope and positioning  
- [Trust layer](docs/trust-layer.md) — policy, risk, profiles  
- [Starter use cases](docs/use-cases.md) — `examples/` walkthrough  
- [Concepts](docs/concepts.md) — IR, validation, `.tq` surface  
- [Trust policies](docs/trust-policies.md) · [Trust scoring](docs/trust-scoring.md) · [Trust profiles](docs/trust-profiles.md)  
- [Examples](docs/examples.md) — CI, metadata, migration  
- [Architecture](docs/architecture.md) · [Diagrams](docs/diagrams.md)  
- [Roadmap](docs/roadmap.md) · [Language evolution](docs/language-evolution.md)  
- [Why now?](docs/why-now.md) · [Public launch](docs/public-launch.md)  
- [First run](docs/first-run.md) · [Quickstart](docs/quickstart.md) · [FAQ](docs/faq.md)  
- [CHANGELOG](CHANGELOG.md) · [Early release notes](RELEASE_NOTES_v0.md)  
- [CI reports](docs/ci-report.md) · [Project config](docs/project-config.md)  
- [Repository status & pre-v1 readiness](docs/status.md) — audit snapshot, adoption bar  
- [Flagship demo](docs/flagship-demo.md) · [AI Guardrail Demo](docs/guardrail-demo.md)

## Design principles

- **Canonical IR first** — One **`ir_goal`** shape (versioned bundle) as the interchange **contract**.
- **Validation and trust as gates** — Structure, semantics, policy, and risk are deliberate; outcomes are visible in APIs and CLI output.
- **Portability** — IR is **runtime-agnostic**; execution stays outside this layer.
- **Optional ergonomic authoring** — **`.tq`** is strict so text maps deterministically to IR when you use it.
- **No silent ambiguity** — Invalid or unknown constructs surface as errors with stable codes (e.g. `PX_TQ_*` for surface parse), not best-effort acceptance.
- **Thin core** — Verifiable spec and trust machinery, not a platform.

## License

[MIT](LICENSE)

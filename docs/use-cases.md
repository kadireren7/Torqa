# Starter use cases

Three runnable artifacts under [`examples/`](../examples/) show how Torqa helps **today** with the **shipped** strict `.tq` surface, JSON bundles, and the `torqa` CLI. Nothing here executes business workflows—only **parse, load, validate**.

---

## 1. `examples/approval_flow.tq` — Human-authored spec + audit metadata

**Demonstrates:** Strict `.tq` with **`meta:`** (`owner`, `severity`) carried into `metadata.surface_meta` for review and policy tooling, using the **reference flow vocabulary** (`create session`, `emit login_success`).

**Who uses it:** Teams that want **ownership and risk labels** on the same validated IR they already commit to git.

**How to run:**

```bash
torqa validate examples/approval_flow.tq
torqa inspect examples/approval_flow.tq
```

**Expected value:** A **single file** that passes the same structural and semantic gates as the rest of the core; metadata is **honest strings**—not new effects.

**Honest limit:** The business story is “approval handoff”; the **step text** is still the small `tq_v1` set. Broader approval stages require **your** surface/registry extensions—Torqa still gives you **validation discipline** at the boundary.

---

## 2. `examples/ai_generated.json` — Tool or model output as bundle JSON

**Demonstrates:** A **full bundle** `{"ir_goal": …}` in the same shape as **`parse_tq_source`** output—what an importer or generator would hand to the repo. Validation is identical whether the bytes came from `.tq` or JSON.

**Who uses it:** Pipelines that **emit JSON** (templates, migrations, assistants) and need a **checkable artifact** before execution.

**How to run:**

```bash
torqa validate examples/ai_generated.json
torqa inspect examples/ai_generated.json
```

**Expected value:** **No second-class input**: JSON hits **`load` → `ir_goal_from_json` → `validate_ir` → semantics**, same as text.

---

## 3. `examples/ci_check.md` — Gate specs in CI

**Demonstrates:** How to run **`torqa validate`** over committed files in **bash** or **PowerShell**, and why that catches spec drift early.

**Who uses it:** Maintainers wiring **lint jobs** or **pre-merge checks** without adding a workflow runtime.

**How to run:** Follow the commands in [`examples/ci_check.md`](../examples/ci_check.md).

**Expected value:** **Deterministic** failures on bad specs; reviewers see **intent**, not surprise parse errors at release time.

---

## See also

- [Examples (patterns)](examples.md) — Broader scenarios (migration, multi-runtime).
- [Flagship demo](flagship-demo.md) — One narrative across `.tq` and JSON.
- [Quickstart](quickstart.md) — Install and CLI reference.

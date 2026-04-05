# What TORQA does best

**Audience:** Anyone asking “is TORQA the right tool?” before investing time.

---

## The core idea

TORQA is strongest when you need **checkable intent** in a **small, reusable surface** that **drives real outputs**.

- **Validated semantics first:** `.tq` compiles to canonical IR; **diagnostics** run before you treat a spec as “done.”
- **Compression-friendly workflow model:** the same product story often fits in far fewer tokens than a long NL spec or chat log — *when* you measure paired scenarios honestly ([`TOKEN_PROOF.md`](TOKEN_PROOF.md), [`TOKEN_PROOF_REAL.md`](TOKEN_PROOF_REAL.md)).
- **One IR, multiple projections:** from one passing bundle you can materialize **webapp**, **SQL**, **stubs**, and more — without maintaining parallel descriptions ([`QUICKSTART.md`](QUICKSTART.md) → `torqa build`).

**Positioning line (product):** TORQA is **not** “another chat-to-code toy”; it is a **compression-first execution layer** — NL or `.tq` in, validated spec in the middle, artifacts out ([`EXECUTION_LAYER_PROOF.md`](EXECUTION_LAYER_PROOF.md)).

---

## Where it shines today

| Area | Why |
|------|-----|
| **Flow-shaped products** | Inputs, guards, transitions, explicit **result** — auth/session-shaped demos are the flagship ([`examples/benchmark_flagship/`](../examples/benchmark_flagship/)). |
| **Hard validation gate** | Bad specs **fail fast** with structured errors; gate proofs are reproducible ([`VALIDATION_GATE.md`](VALIDATION_GATE.md)). |
| **Measured compression stories** | Workflow token proof + flagship compression baselines are **scenario-bound** but **reproducible** ([`TOKEN_PROOF.md`](TOKEN_PROOF.md), [`BENCHMARK_COMPRESSION.md`](BENCHMARK_COMPRESSION.md)). |
| **Developer-first trial** | CLI + **official** Electron desktop + docs-linked paths ([`TRY_TORQA.md`](TRY_TORQA.md)). |

---

## What to use for depth

- **North star & roadmap (non-normative):** [`TORQA_VISION_NORTH_STAR.md`](TORQA_VISION_NORTH_STAR.md), [`ROADMAP.md`](../ROADMAP.md).
- **Architecture roles:** [`ARCHITECTURE_RULES.md`](ARCHITECTURE_RULES.md), [`SURFACE_CLASSIFICATION.md`](SURFACE_CLASSIFICATION.md).
- **Limits and caveats:** [`KNOWN_LIMITS.md`](KNOWN_LIMITS.md).
